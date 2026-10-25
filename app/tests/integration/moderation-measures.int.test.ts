import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { saveListing } from "@/modules/listings/service";
import { getConversation } from "@/modules/messaging/queries";
import { sendMessage } from "@/modules/messaging/service";
import {
  createAppeal,
  createReport,
  decideAppeal,
  dismissReport,
  getModerationForUser,
  listOpenReports,
} from "@/modules/moderation/service";
import { applyUserMeasure, expireRestrictions } from "@/modules/moderation/users";
import { notificationsFor } from "./moderation-fixtures";
import { createUser, owner, rentalDraft, resetDb } from "./helpers";
import { completedBooking, DAY, setRentalsOpen } from "./rental-fixtures";

const later = (days: number) => new Date(Date.now() + days * DAY);
const statement = "Gjentatte meldinger med trusler til en annen bruker.";

async function status(userId: string) {
  const [p] = await owner
    .select({ status: schema.userProfiles.status })
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId));
  return p!.status;
}

describe("moderation: account measures, appeals, reported content (P03-03)", () => {
  beforeAll(() => setRentalsOpen(true));
  afterAll(() => setRentalsOpen(false));
  beforeEach(resetDb);

  it("restrict → cannot publish; appeal → another staff member reverses → active again", async () => {
    const user = await createUser({ name: "Ola O." });
    const modA = await createUser({ role: "moderator", staff2fa: true });
    const modB = await createUser({ role: "admin", staff2fa: true });
    const { actionId } = await applyUserMeasure(modA, {
      userId: user.id,
      measure: "restrict",
      reasonCode: "harassment",
      statement,
    });
    expect(await status(user.id)).toBe("restricted");
    expect(await notificationsFor(user.id)).toContain("account_measure");
    const restricted = { ...user, status: "restricted" as const };
    await expect(saveListing(restricted, await rentalDraft(), [], { intent: "publish" })).rejects.toMatchObject({
      code: "account_restricted",
    });

    const view = await getModerationForUser(restricted, actionId);
    expect(view?.action.action).toBe("user_restricted");
    await createAppeal(restricted, { actionId, text: "Jeg har ikke sendt trusler, se samtalen." });
    const [appeal] = await owner.select().from(schema.appeals);
    await expect(
      decideAppeal(modA, { appealId: appeal!.id, outcome: "reversed", decision: "Ny vurdering av saken." }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await decideAppeal(modB, { appealId: appeal!.id, outcome: "reversed", decision: "Ny vurdering av saken." });
    expect(await status(user.id)).toBe("active");
    const actions = await owner
      .select({ action: schema.moderationActions.action })
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.targetId, user.id));
    expect(actions.map((a) => a.action).sort()).toEqual(["user_reinstated", "user_restricted"]);
  });

  it("suspension revokes every session; reinstate opens the account again", async () => {
    const user = await createUser();
    const admin = await createUser({ role: "admin", staff2fa: true });
    await owner.insert(schema.sessions).values({ userId: user.id, token: `t-${user.id}`, expiresAt: later(10) });
    await applyUserMeasure(admin, { userId: user.id, measure: "suspend", reasonCode: "fraud_or_scam", statement });
    expect(await status(user.id)).toBe("suspended");
    expect(await owner.select().from(schema.sessions).where(eq(schema.sessions.userId, user.id))).toHaveLength(0);
    await applyUserMeasure(admin, { userId: user.id, measure: "reinstate", reasonCode: "other", statement });
    expect(await status(user.id)).toBe("active");
  });

  it("a restriction with an end date ends by itself (worker), and only then", async () => {
    const user = await createUser();
    const mod = await createUser({ role: "moderator", staff2fa: true });
    await applyUserMeasure(mod, {
      userId: user.id,
      measure: "restrict",
      reasonCode: "spam",
      statement,
      until: later(3).toISOString(),
    });
    expect(await expireRestrictions(later(2))).toBe(0);
    expect(await expireRestrictions(later(4))).toBe(1);
    expect(await expireRestrictions(later(4))).toBe(0);
    expect(await status(user.id)).toBe("active");
    expect(await notificationsFor(user.id)).toContain("restriction_ended");
  });

  it("staff never act on themselves; moderators never act on staff accounts", async () => {
    const mod = await createUser({ role: "moderator", staff2fa: true });
    const otherMod = await createUser({ role: "moderator", staff2fa: true });
    const admin = await createUser({ role: "admin", staff2fa: true });
    const member = await createUser();
    await expect(
      applyUserMeasure(mod, { userId: mod.id, measure: "warn", reasonCode: "other", statement }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      applyUserMeasure(mod, { userId: otherMod.id, measure: "restrict", reasonCode: "other", statement }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      applyUserMeasure(member, { userId: otherMod.id, measure: "warn", reasonCode: "other", statement }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await applyUserMeasure(admin, { userId: otherMod.id, measure: "warn", reasonCode: "other", statement });
  });

  it("N15: staff read only the reported message, never the conversation, and the view is audited", async () => {
    const lender = await createUser();
    const asker = await createUser();
    const mod = await createUser({ role: "moderator", staff2fa: true });
    const { id: listingId } = await saveListing(lender, await rentalDraft(), [], { intent: "publish" });
    const first = await sendMessage(asker, { body: "Hei, er den ledig?", listingId });
    const rude = await sendMessage(asker, { body: "Du er en idiot", conversationId: first.conversationId });
    expect(await getConversation(mod, first.conversationId)).toBeNull();
    await createReport(lender, {
      targetType: "message",
      targetId: rude.messageId,
      reason: "harassment",
      details: "",
      goodFaith: "on",
    });
    const queue = await listOpenReports(mod);
    expect(queue.map((r) => r.messageBody)).toEqual(["Du er en idiot"]);
    const audits = await owner
      .select()
      .from(schema.auditEvents)
      .where(and(eq(schema.auditEvents.action, "staff.view_report_messages"), eq(schema.auditEvents.actorId, mod.id)));
    expect(audits).toHaveLength(1);
    // Still no access to the rest of the thread.
    expect(await getConversation(mod, first.conversationId)).toBeNull();
  });

  it("published reviews can be reported, never one's own, and not by staff it concerns", async () => {
    const { lender, renter, id } = await completedBooking();
    const [review] = await owner
      .insert(schema.reviews)
      .values({
        bookingId: id,
        authorId: renter.id,
        subjectId: lender.id,
        authorRole: "renter",
        ratingCommunication: 1,
        ratingPunctuality: 1,
        ratingAccuracy: 1,
        ratingItemCondition: 1,
        ratingAgreement: 1,
        comment: "Svindler!",
        status: "published",
        publishedAt: new Date(),
      })
      .returning();
    const report = (targetId: string) => ({
      targetType: "review" as const,
      targetId,
      reason: "fake_review" as const,
      details: "",
      goodFaith: "on" as const,
    });
    await expect(createReport(renter, report(review!.id))).rejects.toMatchObject({ code: "not_found" });
    await createReport(lender, report(review!.id));
    const mod = await createUser({ role: "moderator", staff2fa: true });
    const [row] = await listOpenReports(mod, { type: "review" });
    expect(row).toMatchObject({ targetType: "review", reviewComment: "Svindler!" });
    // The subject of the review, if they were staff, could not handle the report.
    const subjectAsStaff = { ...lender, role: "moderator" as const, staff2fa: true };
    await expect(dismissReport(subjectAsStaff, row!.id, "")).rejects.toMatchObject({ code: "forbidden" });
  });
});
