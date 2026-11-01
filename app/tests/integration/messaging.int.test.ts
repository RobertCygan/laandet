import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { saveListing } from "@/modules/listings/service";
import { sendMessageEmails } from "@/modules/messaging/email-batch";
import { getConversation, listInbox, pollConversation, unreadCount } from "@/modules/messaging/queries";
import { assertCanContact, blockUser, markRead, sendMessage, unblockUser } from "@/modules/messaging/service";
import { createReport, listOpenReports } from "@/modules/moderation/service";
import { renderEmail } from "@/modules/notifications/email-templates";
import type { UserActor } from "@/modules/authz/actor-types";
import type { ListingDraft } from "@/modules/listings/rules";
import { createUser, owner, rentalDraft, resetDb } from "./helpers";

const MINUTE = 60_000;

async function listingOf(user: UserActor, overrides: Partial<ListingDraft> = {}) {
  const { id } = await saveListing(user, await rentalDraft(overrides), [], { intent: "publish" });
  return id;
}

/** A (owner) and B (interested) with one conversation about A's listing. */
async function pair(opts: { bNew?: boolean } = {}) {
  const a = await createUser({ name: "Anne Eier" });
  const b = await createUser({ name: "Bjørn Leier", isNewAccount: opts.bNew });
  const listingId = await listingOf(a);
  const { conversationId, messageId } = await sendMessage(b, { listingId, body: "Hei! Er drillen ledig i helgen?" });
  return { a, b, listingId, conversationId, messageId };
}

/** Minimal booking in progress, written with the owner role (the booking service is P02-02's). */
async function activeBooking(conversationId: string, listingId: string, ownerId: string, renterId: string) {
  const start = new Date(Date.now() + 24 * 3600 * 1000);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  await owner.insert(schema.bookings).values({
    listingId,
    conversationId,
    ownerId,
    renterId,
    status: "confirmed",
    period: `[${start.toISOString()},${end.toISOString()})`,
    valueCategory: "A",
    declaredValueOre: 300000,
    priceOre: 15000,
    priceUnit: "day",
    units: 1,
    totalPriceOre: 15000,
    handoverMethod: "pickup",
    returnMethod: "pickup",
    ownerResponseDueAt: start,
  });
}

/** Move every message in a conversation back in time (the batch job waits 2 minutes before emailing). */
async function ageMessages(conversationId: string, minutes: number) {
  await owner.execute(
    sql`UPDATE messages SET created_at = created_at - make_interval(mins => ${minutes}) WHERE conversation_id = ${conversationId}`,
  );
}

async function outboxFor(userId: string) {
  return owner.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.toUserId, userId));
}

describe("conversations and messages (P02-01)", () => {
  beforeEach(resetDb);

  it("N2: only the two participants can read a conversation; everyone else gets 404", async () => {
    const { a, b, conversationId, messageId } = await pair();
    const c = await createUser({ name: "Carl Annen" });
    const mod = await createUser({ role: "moderator", staff2fa: true });

    for (const outsider of [c, mod]) {
      expect(await getConversation(outsider, conversationId)).toBeNull();
      expect(await pollConversation(outsider, conversationId, "")).toBeNull();
      expect(await listInbox(outsider)).toEqual([]);
      await expect(sendMessage(outsider, { conversationId, body: "Hei" })).rejects.toMatchObject({
        code: "not_found",
      });
      await expect(
        createReport(outsider, {
          targetType: "message",
          targetId: messageId,
          reason: "other",
          details: "",
          goodFaith: "on",
        }),
      ).rejects.toMatchObject({ code: "not_found" });
    }
    expect(await getConversation({ kind: "anonymous" }, conversationId)).toBeNull();

    const forA = await getConversation(a, conversationId);
    expect(forA?.messages.map((m) => m.body)).toEqual(["Hei! Er drillen ledig i helgen?"]);
    expect(forA?.other).toEqual({ id: b.id, name: "Bjørn Leier" });
    expect(await unreadCount(a)).toBe(1);
    expect((await listInbox(a))[0]).toMatchObject({ id: conversationId, unread: true, otherName: "Bjørn Leier" });
    await markRead(a, conversationId);
    expect(await unreadCount(a)).toBe(0);
    expect(await unreadCount(b)).toBe(0);

    // The same pair and listing share one conversation.
    const again = await sendMessage(b, { listingId: forA!.listingId, body: "Eller neste helg?" });
    expect(again.conversationId).toBe(conversationId);
  });

  it("blocking stops messages and new contact in both directions; a booking in progress keeps the thread open", async () => {
    const { a, b, listingId, conversationId } = await pair();
    const otherListingOfA = await listingOf(a, { title: "Stige, 4 meter" });
    const listingOfB = await listingOf(b, { title: "Tilhenger" });

    await blockUser(a, { userId: b.id });
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      await expect(sendMessage(from, { conversationId, body: "Hallo?" })).rejects.toMatchObject({
        code: "forbidden",
        message: "blocked",
      });
      // Requests and claims call the same guard before they create anything.
      await expect(assertCanContact(db, from.id, to.id)).rejects.toMatchObject({
        code: "forbidden",
        message: "blocked",
      });
    }
    await expect(sendMessage(b, { listingId: otherListingOfA, body: "Hei" })).rejects.toMatchObject({
      message: "blocked",
    });
    await expect(sendMessage(a, { listingId: listingOfB, body: "Hei" })).rejects.toMatchObject({ message: "blocked" });

    // Hidden from the blocker; the other side sees a closed thread.
    expect(await listInbox(a)).toEqual([]);
    expect(await getConversation(b, conversationId)).toMatchObject({ blockedByOther: true, canSend: false });
    expect(await getConversation(a, conversationId)).toMatchObject({ blockedByMe: true, canSend: false });

    // A booking in progress: both can still read and write, and the thread is back in the inbox.
    await activeBooking(conversationId, listingId, a.id, b.id);
    expect(await getConversation(a, conversationId)).toMatchObject({ blockedByMe: true, canSend: true });
    await sendMessage(b, { conversationId, body: "Jeg kommer kl. 18." });
    await sendMessage(a, { conversationId, body: "Greit." });
    expect((await listInbox(a)).map((c) => c.id)).toEqual([conversationId]);
    // …but no new conversations.
    await expect(sendMessage(b, { listingId: otherListingOfA, body: "Hei" })).rejects.toMatchObject({
      message: "blocked",
    });

    await unblockUser(a, { userId: b.id });
    await assertCanContact(db, b.id, a.id);
    await sendMessage(b, { listingId: otherListingOfA, body: "Hei igjen" });

    const audit = await owner.select().from(schema.auditEvents).where(eq(schema.auditEvents.actorId, a.id));
    expect(audit.map((e) => e.action)).toEqual(expect.arrayContaining(["user.block", "user.unblock"]));
  });

  it("refuses your own listing, demo listings, restricted starters and stops the 61st message in an hour", async () => {
    const a = await createUser();
    const ownListing = await listingOf(a);
    await expect(sendMessage(a, { listingId: ownListing, body: "Hei" })).rejects.toMatchObject({
      code: "forbidden",
      message: "own_listing",
    });

    const restricted = await createUser({ status: "restricted" });
    await expect(sendMessage(restricted, { listingId: ownListing, body: "Hei" })).rejects.toMatchObject({
      code: "account_restricted",
    });

    await owner.update(schema.listings).set({ isDemo: true }).where(eq(schema.listings.id, ownListing));
    await expect(sendMessage(await createUser(), { listingId: ownListing, body: "Hei" })).rejects.toMatchObject({
      message: "listing_unavailable",
    });

    // New accounts: 60 messages per hour.
    const { b, conversationId } = await pair({ bNew: true });
    for (let i = 1; i < 60; i++) await sendMessage(b, { conversationId, body: `Melding ${i}` });
    await expect(sendMessage(b, { conversationId, body: "En til" })).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("restricted accounts can still reply in an existing conversation", async () => {
    const { a, conversationId } = await pair();
    await owner.update(schema.userProfiles).set({ status: "restricted" }).where(eq(schema.userProfiles.userId, a.id));
    await sendMessage({ ...a, status: "restricted" }, { conversationId, body: "Ja, den er ledig." });
  });

  it("a failed write never carries the message text into the error (and so into logs)", async () => {
    const { b, conversationId } = await pair();
    const body = `HEMMELIG-${"x".repeat(4000)}`; // longer than the database allows
    const err = await sendMessage(b, { conversationId, body }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    const text = `${(err as Error).message} ${String((err as Error).cause ?? "")} ${(err as Error).stack ?? ""}`;
    expect(text).not.toContain("HEMMELIG");
  });

  it("reply to «Ønskes leid» can attach only the sender's own published «Leies ut» listing (D-020)", async () => {
    const wanter = await createUser();
    const wantedId = await listingOf(wanter, {
      type: "wanted",
      title: "Ønsker å leie tilhenger",
      priceOre: null,
      priceUnit: null,
      declaredValueOre: null,
      depositOre: null,
    });
    const replier = await createUser();
    const ownRental = await listingOf(replier, { title: "Tilhenger, 750 kg" });
    const someoneElses = await listingOf(await createUser(), { title: "Annen tilhenger" });

    await expect(
      sendMessage(replier, { listingId: wantedId, body: "Jeg har en", attachedListingId: someoneElses }),
    ).rejects.toMatchObject({ code: "validation", message: "attachment_invalid" });
    const { conversationId } = await sendMessage(replier, {
      listingId: wantedId,
      body: "Jeg har en",
      attachedListingId: ownRental,
    });
    const thread = await getConversation(wanter, conversationId);
    expect(thread?.messages[0]?.attachedListing).toEqual({ id: ownRental, title: "Tilhenger, 750 kg" });
  });

  it("a participant can report the other party's message; staff see only that message", async () => {
    const { a, b, messageId } = await pair();
    const report = {
      targetType: "message" as const,
      targetId: messageId,
      reason: "other" as const,
      details: "",
      goodFaith: "on" as const,
    };
    await expect(createReport(b, report)).rejects.toMatchObject({ code: "not_found" }); // own message
    await createReport(a, report);
    const [row] = await owner.select().from(schema.reports).where(eq(schema.reports.reporterId, a.id));
    expect(row).toMatchObject({ targetType: "message", targetId: messageId, attachedMessageIds: [messageId] });
    const [queued] = await listOpenReports(await createUser({ role: "moderator", staff2fa: true }));
    expect(queued).toMatchObject({ messageBody: "Hei! Er drillen ledig i helgen?", messageSenderId: b.id });
  });

  it("emails at most once per conversation in 15 minutes, only unread messages, never the text", async () => {
    const { a, b, conversationId } = await pair();
    const body = "Hei! Er drillen ledig i helgen?";

    // Too fresh: the reader may be online.
    expect(await sendMessageEmails(db)).toBe(0);
    await ageMessages(conversationId, 5);
    expect(await sendMessageEmails(db)).toBe(1);
    expect(await sendMessageEmails(db)).toBe(0);

    const [mail] = await outboxFor(a.id);
    expect(mail).toMatchObject({ template: "activity", locale: "nb" });
    expect(mail!.payload).toMatchObject({
      kind: "new_message",
      url: expect.stringContaining(`/meldinger/${conversationId}`),
    });
    expect(JSON.stringify(mail!.payload)).not.toContain("drillen");
    const rendered = renderEmail("activity", "nb", mail!.payload as Record<string, string>);
    expect(`${rendered.subject}\n${rendered.text}`).not.toContain(body);
    expect(await outboxFor(b.id)).toEqual([]); // nothing unread for the sender

    // A second message inside the window: no new email until 15 minutes have passed.
    await sendMessage(b, { conversationId, body: "Hallo igjen" });
    const later = (min: number) => new Date(Date.now() + min * MINUTE);
    expect(await sendMessageEmails(db, later(5))).toBe(0);
    expect(await sendMessageEmails(db, later(16))).toBe(1);
    expect(await sendMessageEmails(db, later(17))).toBe(0);
    expect(await outboxFor(a.id)).toHaveLength(2);

    // Read messages are not emailed.
    await sendMessage(b, { conversationId, body: "Og en til" });
    await markRead(a, conversationId);
    expect(await sendMessageEmails(db, later(40))).toBe(0);

    // Email notifications off: nothing.
    const quiet = await createUser();
    await owner
      .update(schema.userProfiles)
      .set({ emailNotifications: false })
      .where(eq(schema.userProfiles.userId, quiet.id));
    const quietListing = await listingOf(quiet);
    const q = await sendMessage(b, { listingId: quietListing, body: "Hei" });
    await ageMessages(q.conversationId, 5);
    expect(await sendMessageEmails(db, later(60))).toBe(0);
    expect(await outboxFor(quiet.id)).toEqual([]);
  });
});
