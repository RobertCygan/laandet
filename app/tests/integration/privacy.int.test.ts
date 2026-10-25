import sharp from "sharp";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { addEntry, confirmReport } from "@/modules/condition/service";
import { saveListing } from "@/modules/listings/service";
import { uploadImage } from "@/modules/media/service";
import { DELETED_NAME, eraseDueAccounts, handleInactiveAccounts } from "@/modules/privacy/erasure";
import { buildDataExport } from "@/modules/privacy/export";
import {
  deleteOrphanPrivateMedia,
  purgeAppendOnly,
  purgeDeletedListings,
  purgeNotificationsAndOutbox,
  purgeOldMessages,
} from "@/modules/privacy/retention";
import { getBookingForParty } from "@/modules/rentals/queries";
import { cancelBooking, requestBooking } from "@/modules/rentals/service";
import { reviewSchema, submitReview } from "@/modules/reviews/service";
import { createUser, owner, rentalDraft, resetDb } from "./helpers";
import { ALL_CHECKED, confirmedBooking, DAY, entry, HOUR, inDays, setRentalsOpen } from "./rental-fixtures";

async function completed() {
  const f = await confirmedBooking();
  await addEntry(
    f.lender,
    entry(f.id, "handover", { notes: "Utleiers egen merknad" }),
    new Date(f.start.getTime() - HOUR),
  );
  for (const who of [f.renter, f.lender])
    await confirmReport(who, {
      bookingId: f.id,
      phase: "handover",
      decision: "confirm",
      checklist: ALL_CHECKED,
      comment: "",
    });
  await addEntry(f.renter, entry(f.id, "return", { proposedOutcome: "returned_ok" }), f.end);
  for (const who of [f.renter, f.lender])
    await confirmReport(who, { bookingId: f.id, phase: "return", decision: "confirm", checklist: {}, comment: "" });
  return f;
}

async function emailOf(userId: string) {
  const [u] = await owner.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId));
  return u!.email;
}

async function conversationWithMessage(listingId: string, ownerId: string, initiatorId: string, body: string) {
  const [c] = await owner
    .insert(schema.conversations)
    .values({ listingId, initiatorId, listingOwnerId: ownerId })
    .returning();
  await owner.insert(schema.conversationParticipants).values([
    { conversationId: c!.id, userId: ownerId },
    { conversationId: c!.id, userId: initiatorId },
  ]);
  const [m] = await owner
    .insert(schema.messages)
    .values({ conversationId: c!.id, senderId: initiatorId, kind: "user", body })
    .returning();
  return { conversationId: c!.id, messageId: m!.id };
}

describe("data export (P03-06)", () => {
  beforeAll(() => setRentalsOpen(true));
  afterAll(() => setRentalsOpen(false));
  beforeEach(resetDb);

  it("contains the person's own data, never the other party's email, staff notes or a sealed review", async () => {
    const { lender, renter, id } = await completed();
    await submitReview(
      lender,
      reviewSchema.parse({
        bookingId: id,
        communication: "2",
        punctuality: "2",
        itemCondition: "2",
        agreement: "2",
        comment: "Forseglet vurdering om leietakeren",
      }),
    );
    const [d] = await owner
      .insert(schema.disputes)
      .values({
        bookingId: id,
        openedBy: lender.id,
        respondentId: renter.id,
        category: "late_return",
        summary: "Leveringen var to dager forsinket.",
        responseDueAt: new Date(Date.now() + 7 * DAY),
      })
      .returning();
    await owner.insert(schema.disputeEvents).values([
      { disputeId: d!.id, kind: "statement", body: "Synlig for partene", visibility: "parties" },
      { disputeId: d!.id, kind: "support_note", body: "Intern merknad fra Laandet", visibility: "staff_only" },
    ]);

    const data = await buildDataExport(renter);
    const json = JSON.stringify(data);
    expect(data.account).toMatchObject({ id: renter.id, email: await emailOf(renter.id) });
    expect(data.rentals).toHaveLength(1);
    expect(data.rentals[0]!.agreements[0]!.text).toContain("Leietaker L.");
    expect(data.rentals[0]!.yourConditionEntries.every((e) => e.notes !== "Utleiers egen merknad")).toBe(true);
    expect(data.cases[0]!.events.map((e) => e.body)).toEqual(["Synlig for partene"]);
    expect(json).not.toContain(await emailOf(lender.id));
    expect(json).not.toContain("Intern merknad fra Laandet");
    expect(json).not.toContain("Forseglet vurdering om leietakeren");
    expect(json).not.toContain("ip_hash");

    // The author sees their own sealed review.
    const own = await buildDataExport(lender);
    expect(own.reviewsWritten.map((r) => r.comment)).toEqual(["Forseglet vurdering om leietakeren"]);

    const audits = await owner
      .select()
      .from(schema.auditEvents)
      .where(and(eq(schema.auditEvents.action, "user.data_export"), eq(schema.auditEvents.actorId, renter.id)));
    expect(audits).toHaveLength(1);
  });

  it("is limited to five a day, works for suspended accounts, and not for visitors", async () => {
    const u = await createUser();
    for (let i = 0; i < 5; i++) await buildDataExport(u);
    await expect(buildDataExport(u)).rejects.toMatchObject({ code: "rate_limited" });
    const suspended = await createUser({ status: "suspended" });
    await expect(buildDataExport(suspended)).resolves.toMatchObject({ account: { id: suspended.id } });
    await expect(buildDataExport({ kind: "anonymous" })).rejects.toMatchObject({ code: "auth_required" });
  });
});

describe("retention jobs (P03-06), against back-dated rows", () => {
  beforeAll(() => setRentalsOpen(true));
  afterAll(() => setRentalsOpen(false));
  beforeEach(resetDb);

  it("notifications after 12 months, outbox rows 30 days after sending, nothing newer", async () => {
    const u = await createUser();
    await owner.insert(schema.notifications).values([
      { userId: u.id, type: "new_message", createdAt: new Date(Date.now() - 400 * DAY) },
      { userId: u.id, type: "new_message" },
    ]);
    await owner.insert(schema.emailOutbox).values([
      {
        toEmail: "a@example.test",
        template: "activity",
        locale: "nb",
        status: "sent",
        sentAt: new Date(Date.now() - 31 * DAY),
      },
      {
        toEmail: "b@example.test",
        template: "activity",
        locale: "nb",
        status: "sent",
        sentAt: new Date(Date.now() - 2 * DAY),
      },
      { toEmail: "c@example.test", template: "activity", locale: "nb" },
    ]);
    expect(await purgeNotificationsAndOutbox()).toBe(2);
    expect(await purgeNotificationsAndOutbox()).toBe(0);
    expect(await owner.select().from(schema.notifications)).toHaveLength(1);
    expect((await owner.select().from(schema.emailOutbox)).map((o) => o.toEmail).sort()).toEqual([
      "b@example.test",
      "c@example.test",
    ]);
  });

  it("deleted listings go after 30 days; a listing someone wrote about keeps its row but loses its images", async () => {
    const a = await createUser();
    const b = await createUser();
    const { id: alone } = await saveListing(a, await rentalDraft({ title: "Gammel hagesaks" }), [], {
      intent: "publish",
    });
    const { id: talked } = await saveListing(a, await rentalDraft({ title: "Gammel stige" }), [], {
      intent: "publish",
    });
    const { id: recent } = await saveListing(a, await rentalDraft({ title: "Ny trillebår" }), [], {
      intent: "publish",
    });
    await conversationWithMessage(talked, a.id, b.id, "Er den ledig?");
    await owner
      .update(schema.listings)
      .set({ status: "deleted", deletedAt: new Date(Date.now() - 31 * DAY) })
      .where(sql`${schema.listings.id} IN (${alone}, ${talked})`);
    await owner
      .update(schema.listings)
      .set({ status: "deleted", deletedAt: new Date(Date.now() - 5 * DAY) })
      .where(eq(schema.listings.id, recent));
    expect(await purgeDeletedListings()).toBe(1);
    const left = await owner.select({ id: schema.listings.id }).from(schema.listings);
    expect(left.map((l) => l.id).sort()).toEqual([talked, recent].sort());
  });

  it("messages 12 months after the last activity, except those a report still refers to", async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const { id: l1 } = await saveListing(a, await rentalDraft({ title: "Tilhenger" }), [], { intent: "publish" });
    const old = await conversationWithMessage(l1, a.id, b.id, "Gammel melding");
    const reported = await conversationWithMessage(l1, a.id, c.id, "Rapportert melding");
    const fresh = await conversationWithMessage(
      (await saveListing(a, await rentalDraft({ title: "Kajakk" }), [], { intent: "publish" })).id,
      a.id,
      b.id,
      "Ny melding",
    );
    await owner.insert(schema.reports).values({
      reporterId: a.id,
      targetType: "message",
      targetId: reported.messageId,
      reason: "harassment",
    });
    const longAgo = new Date(Date.now() - 400 * DAY);
    await owner
      .update(schema.conversations)
      .set({ lastMessageAt: longAgo })
      .where(sql`${schema.conversations.id} IN (${old.conversationId}, ${reported.conversationId})`);

    expect(await purgeOldMessages()).toBe(1);
    expect(await purgeOldMessages()).toBe(0);
    const convs = (await owner.select({ id: schema.conversations.id }).from(schema.conversations)).map((r) => r.id);
    expect(convs.sort()).toEqual([reported.conversationId, fresh.conversationId].sort());
    const msgs = (await owner.select({ body: schema.messages.body }).from(schema.messages)).map((m) => m.body);
    expect(msgs.sort()).toEqual(["Ny melding", "Rapportert melding"]);
  });

  it("bookings with their evidence 3 years after the end; a case keeps them until it is 3 years closed", async () => {
    const f = await completed();
    await submitReview(
      f.renter,
      reviewSchema.parse({
        bookingId: f.id,
        communication: "5",
        punctuality: "5",
        itemCondition: "5",
        agreement: "5",
        accuracy: "5",
      }),
    );
    const back = (years: number) =>
      owner.execute(
        sql`UPDATE bookings SET period = tstzrange(now() - make_interval(years => ${years}) - interval '2 days', now() - make_interval(years => ${years})) WHERE id = ${f.id}`,
      );
    await back(2);
    expect((await purgeAppendOnly()).bookings).toBe(0);

    await back(4);
    const [d] = await owner
      .insert(schema.disputes)
      .values({
        bookingId: f.id,
        openedBy: f.lender.id,
        respondentId: f.renter.id,
        category: "damaged",
        summary: "Riper på sagbladet etter leie.",
        responseDueAt: new Date(),
        status: "closed_without_agreement",
        closedAt: new Date(Date.now() - 365 * DAY),
      })
      .returning();
    await owner.insert(schema.disputeEvents).values({ disputeId: d!.id, kind: "statement", body: "Forklaring" });
    expect(await purgeAppendOnly()).toMatchObject({ disputes: 0, bookings: 0 });

    await owner
      .update(schema.disputes)
      .set({ closedAt: new Date(Date.now() - 4 * 365 * DAY) })
      .where(eq(schema.disputes.id, d!.id));
    expect(await purgeAppendOnly()).toMatchObject({ disputes: 1, bookings: 1 });
    for (const table of [
      schema.bookings,
      schema.bookingEvents,
      schema.contracts,
      schema.contractAcceptances,
      schema.conditionReports,
      schema.conditionEntries,
      schema.conditionConfirmations,
      schema.reviews,
      schema.disputes,
      schema.disputeEvents,
    ]) {
      expect(await owner.select().from(table)).toHaveLength(0);
    }
    expect(await purgeAppendOnly()).toMatchObject({ disputes: 0, bookings: 0 });
    // The app role cannot purge early by itself.
    const { db } = await import("@/db/client");
    await expect(db.execute(sql`DELETE FROM contracts`)).rejects.toThrow();
  });

  it("reports and moderation 2 years after closure; condition photos never attached are removed", async () => {
    const a = await createUser();
    await owner.insert(schema.reports).values([
      {
        reporterId: a.id,
        targetType: "user",
        targetId: a.id,
        reason: "spam",
        status: "dismissed",
        handledAt: new Date(Date.now() - 3 * 365 * DAY),
      },
      {
        reporterId: a.id,
        targetType: "user",
        targetId: a.id,
        reason: "spam",
        status: "dismissed",
        handledAt: new Date(),
      },
      { reporterId: a.id, targetType: "user", targetId: a.id, reason: "spam" },
    ]);
    await purgeAppendOnly();
    expect(await owner.select().from(schema.reports)).toHaveLength(2);

    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#406080" } })
      .png()
      .toBuffer();
    const up = await uploadImage(a, new File([new Uint8Array(png)], "foto.png", { type: "image/png" }), "condition");
    expect(await deleteOrphanPrivateMedia()).toBe(0);
    await owner
      .update(schema.mediaObjects)
      .set({ createdAt: new Date(Date.now() - 2 * DAY) })
      .where(eq(schema.mediaObjects.id, up.id));
    expect(await deleteOrphanPrivateMedia()).toBe(1);
  });
});

describe("account erasure (P03-06, PRIVACY §6)", () => {
  beforeAll(() => setRentalsOpen(true));
  afterAll(() => setRentalsOpen(false));
  beforeEach(resetDb);

  it("waits for a booking under way, then erases; the other party keeps the agreement", async () => {
    const f = await confirmedBooking();
    const renterEmail = await emailOf(f.renter.id);
    // Another open request from the same renter expires with the erasure.
    const { id: other } = await saveListing(f.lender, await rentalDraft({ title: "Murhammer" }), [], {
      intent: "publish",
    });
    const { id: openRequest } = await requestBooking(f.renter, {
      listingId: other,
      start: inDays(20).toISOString(),
      end: inDays(21).toISOString(),
      handoverMethod: "pickup",
      returnMethod: "pickup",
      message: "",
    });
    await owner
      .update(schema.userProfiles)
      .set({ status: "deletion_pending", deletionRequestedAt: new Date() })
      .where(eq(schema.userProfiles.userId, f.renter.id));

    expect(await eraseDueAccounts()).toBe(0);
    await cancelBooking(f.lender, { bookingId: f.id, reason: "Leietakeren har slettet kontoen." });
    expect(await eraseDueAccounts()).toBe(1);
    expect(await eraseDueAccounts()).toBe(0);

    const [u] = await owner
      .select({ name: schema.users.name, email: schema.users.email, status: schema.userProfiles.status })
      .from(schema.users)
      .innerJoin(schema.userProfiles, eq(schema.userProfiles.userId, schema.users.id))
      .where(eq(schema.users.id, f.renter.id));
    expect(u).toEqual({ name: DELETED_NAME, email: `deleted+${f.renter.id}@invalid`, status: "deleted" });
    expect(await owner.select().from(schema.accounts).where(eq(schema.accounts.userId, f.renter.id))).toHaveLength(0);
    expect(await owner.select().from(schema.sessions).where(eq(schema.sessions.userId, f.renter.id))).toHaveLength(0);
    const [mail] = await owner
      .select()
      .from(schema.emailOutbox)
      .where(and(eq(schema.emailOutbox.template, "account_erased"), eq(schema.emailOutbox.toEmail, renterEmail)));
    expect(mail).toBeTruthy();
    const [req] = await owner.select().from(schema.bookings).where(eq(schema.bookings.id, openRequest));
    expect(req!.status).toBe("expired");

    // The owner still has the agreement, now showing «Slettet bruker» as the counterparty in the app.
    const view = await getBookingForParty(f.lender, f.id);
    expect(view!.renterName).toBe(DELETED_NAME);
    expect(view!.contracts[0]!.renderedText).toContain("Leietaker L.");
  });

  it("inactive accounts: a warning after 24 months, erasure scheduled 60 days later without a sign-in", async () => {
    const quiet = await createUser({ name: "Stille S." });
    const back = await createUser({ name: "Tilbake T." });
    const old = new Date(Date.now() - 25 * 30 * DAY);
    await owner
      .update(schema.users)
      .set({ createdAt: old })
      .where(sql`${schema.users.id} IN (${quiet.id}, ${back.id})`);

    expect(await handleInactiveAccounts()).toEqual({ warned: 2, scheduled: 0 });
    expect(await handleInactiveAccounts()).toEqual({ warned: 0, scheduled: 0 });
    const warnings = await owner
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.template, "inactivity_warning"));
    expect(warnings).toHaveLength(2);

    // 61 days later: one of them signed in after the warning.
    await owner.execute(
      sql`UPDATE audit_events SET occurred_at = now() - interval '61 days' WHERE action = 'privacy.inactivity_warning'`,
    );
    await owner.insert(schema.auditEvents).values({ actorId: back.id, action: "auth.sign_in" });
    expect(await handleInactiveAccounts()).toEqual({ warned: 0, scheduled: 1 });
    const statuses = await owner
      .select({ id: schema.userProfiles.userId, status: schema.userProfiles.status })
      .from(schema.userProfiles)
      .where(sql`${schema.userProfiles.userId} IN (${quiet.id}, ${back.id})`);
    expect(Object.fromEntries(statuses.map((s) => [s.id, s.status]))).toEqual({
      [quiet.id]: "deletion_pending",
      [back.id]: "active",
    });
  });
});
