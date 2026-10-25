import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { searchListings } from "@/modules/listings/queries";
import { saveListing } from "@/modules/listings/service";
import {
  createAppeal,
  createReport,
  decideAppeal,
  dismissReport,
  hideListing,
  listOpenReports,
} from "@/modules/moderation/service";
import { createUser, owner, rentalDraft, resetDb } from "./helpers";

const statement = "Regel: villedende annonse. Bildet viser en annen gjenstand. Bytt bildet og klag hvis du er uenig.";

async function publishedListing() {
  const ownerUser = await createUser({ name: "Eier E." });
  const { id } = await saveListing(ownerUser, await rentalDraft(), [], { intent: "publish" });
  return { ownerUser, id };
}

describe("reporting and moderation (P01-12)", () => {
  beforeEach(resetDb);

  it("requires sign-in to report and stops the 11th report in a day", async () => {
    const { id } = await publishedListing();
    const report = {
      targetType: "listing" as const,
      targetId: id,
      reason: "misleading" as const,
      details: "",
      goodFaith: "on" as const,
    };
    await expect(createReport({ kind: "anonymous" }, report)).rejects.toMatchObject({ code: "auth_required" });
    const reporter = await createUser();
    for (let i = 0; i < 10; i++) await createReport(reporter, report);
    await expect(createReport(reporter, report)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("keeps the queue for staff with 2FA and a fresh session only", async () => {
    await expect(listOpenReports(await createUser())).rejects.toMatchObject({ code: "forbidden" });
    await expect(listOpenReports(await createUser({ role: "moderator" }))).rejects.toMatchObject({
      code: "staff_2fa_required",
    });
    const stale = { ...(await createUser({ role: "moderator", staff2fa: true })), staffSessionFresh: false };
    await expect(listOpenReports(stale)).rejects.toMatchObject({ code: "staff_session_expired" });
    await expect(listOpenReports(await createUser({ role: "moderator", staff2fa: true }))).resolves.toEqual([]);
  });

  it("hiding a listing records the statement, audits it, notifies the owner and removes it from explore", async () => {
    const { ownerUser, id } = await publishedListing();
    const reporter = await createUser();
    await createReport(reporter, {
      targetType: "listing",
      targetId: id,
      reason: "misleading",
      details: "",
      goodFaith: "on",
    });
    const mod = await createUser({ role: "moderator", staff2fa: true });
    const [report] = await listOpenReports(mod);
    await hideListing(mod, { listingId: id, reportId: report!.id, reasonCode: "misleading", statement });

    const [action] = await owner
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.targetId, id));
    expect(action?.statementOfReasons).toBe(statement);
    const audit = await owner
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.action, "moderation.listing_hidden"));
    expect(audit[0]).toMatchObject({ actorId: mod.id, targetId: id, reason: "misleading" });
    const notes = await owner.select().from(schema.notifications).where(eq(schema.notifications.userId, ownerUser.id));
    expect(notes.map((n) => n.type)).toEqual(["listing_hidden"]);
    const mails = await owner.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.toUserId, ownerUser.id));
    expect(mails.map((m) => m.template)).toContain("listing_hidden");
    expect((await searchListings({})).items.map((i) => i.id)).not.toContain(id);
    expect(await listOpenReports(mod)).toEqual([]);
  });

  it("staff never moderate their own listings", async () => {
    const mod = await createUser({ role: "moderator", staff2fa: true });
    const { id } = await saveListing(mod, await rentalDraft(), [], { intent: "publish" });
    await expect(hideListing(mod, { listingId: id, reasonCode: "misleading", statement })).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("appeals: only the owner can appeal, and another staff member decides when one exists", async () => {
    const { ownerUser, id } = await publishedListing();
    const modA = await createUser({ role: "moderator", staff2fa: true });
    const modB = await createUser({ role: "admin", staff2fa: true });
    await hideListing(modA, { listingId: id, reasonCode: "misleading", statement });
    const [action] = await owner
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.targetId, id));

    await expect(
      createAppeal(await createUser(), { actionId: action!.id, text: "Dette er ikke min annonse, men jeg klager." }),
    ).rejects.toMatchObject({ code: "not_found" });
    await createAppeal(ownerUser, {
      actionId: action!.id,
      text: "Jeg har byttet bildet. Vennligst se på saken igjen.",
    });
    await expect(
      createAppeal(ownerUser, { actionId: action!.id, text: "En klage til om samme sak her." }),
    ).rejects.toMatchObject({ code: "conflict" });
    const [appeal] = await owner.select().from(schema.appeals);

    const decision = {
      appealId: appeal!.id,
      outcome: "reversed" as const,
      decision: "Bildet er byttet, annonsen kan vises igjen.",
    };
    await expect(decideAppeal(modA, decision)).rejects.toMatchObject({ code: "forbidden" });
    await decideAppeal(modB, decision);
    const [after] = await owner.select().from(schema.appeals);
    expect(after).toMatchObject({ status: "reversed", decidedBy: modB.id, decidedBySameStaff: false });
    const [listing] = await owner.select().from(schema.listings).where(eq(schema.listings.id, id));
    expect(listing?.status).toBe("paused");
  });

  it("with a single staff member the same person decides, and it is recorded as such", async () => {
    const { ownerUser, id } = await publishedListing();
    const mod = await createUser({ role: "moderator", staff2fa: true });
    await hideListing(mod, { listingId: id, reasonCode: "misleading", statement });
    const [action] = await owner
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.targetId, id));
    await createAppeal(ownerUser, {
      actionId: action!.id,
      text: "Jeg mener avgjørelsen er feil fordi bildet stemmer.",
    });
    const [appeal] = await owner.select().from(schema.appeals);
    await decideAppeal(mod, {
      appealId: appeal!.id,
      outcome: "upheld",
      decision: "Bildet viser fortsatt en annen gjenstand.",
    });
    const [after] = await owner.select().from(schema.appeals);
    expect(after).toMatchObject({ status: "upheld", decidedBySameStaff: true });
  });

  it("staff cannot handle their own cases, and a report must belong to the listing it is used for", async () => {
    const mod = await createUser({ role: "moderator", staff2fa: true });
    const other = await createUser({ role: "admin", staff2fa: true });
    const { id: modListing } = await saveListing(mod, await rentalDraft({ title: "Moderatorens drill" }), [], {
      intent: "publish",
    });
    const { id: otherListing } = await publishedListing();
    const reporter = await createUser();
    await createReport(reporter, {
      targetType: "listing",
      targetId: modListing,
      reason: "misleading",
      details: "",
      goodFaith: "on",
    });
    await createReport(mod, {
      targetType: "listing",
      targetId: otherListing,
      reason: "misleading",
      details: "",
      goodFaith: "on",
    });
    const open = await listOpenReports(other);
    const aboutMod = open.find((r) => r.targetId === modListing)!;
    const byMod = open.find((r) => r.targetId === otherListing)!;

    await expect(dismissReport(mod, aboutMod.id, "")).rejects.toMatchObject({ code: "forbidden" });
    await expect(dismissReport(mod, byMod.id, "")).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      hideListing(mod, { listingId: otherListing, reportId: byMod.id, reasonCode: "misleading", statement }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(
      hideListing(other, { listingId: otherListing, reportId: aboutMod.id, reasonCode: "misleading", statement }),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    await dismissReport(other, aboutMod.id, "Ikke brudd på reglene.");
  });
});
