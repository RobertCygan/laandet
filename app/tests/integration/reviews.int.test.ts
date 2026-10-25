import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { addEntry, confirmReport } from "@/modules/condition/service";
import {
  completedRentalCount,
  getReviewPage,
  listPublishedReviews,
  loadReviewForModeration,
  publishDueReviews,
  ratingSummary,
  removeReview,
  restoreReview,
  reviewSchema,
  submitReview,
} from "@/modules/reviews/service";
import { getPublicProfile } from "@/modules/users/service";
import { createUser, owner, resetDb } from "./helpers";
import { ALL_CHECKED, confirmedBooking, DAY, entry, HOUR, noticesFor, setRentalsOpen } from "./rental-fixtures";

/** Request → agreement → handover → return, both confirming: status `completed`. */
async function completed() {
  const f = await confirmedBooking();
  await addEntry(f.lender, entry(f.id, "handover"), new Date(f.start.getTime() - HOUR));
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

const review = (bookingId: string, extra: Record<string, string> = {}) =>
  reviewSchema.parse({ bookingId, communication: "5", punctuality: "4", itemCondition: "5", agreement: "5", ...extra });

async function statuses(bookingId: string) {
  const rows = await owner
    .select({ status: schema.reviews.status })
    .from(schema.reviews)
    .where(eq(schema.reviews.bookingId, bookingId));
  return rows.map((r) => r.status).sort();
}

describe("reviews (P03-02)", () => {
  beforeAll(() => setRentalsOpen(true));
  afterAll(() => setRentalsOpen(false));
  beforeEach(resetDb);

  it("double-blind: sealed until both have written, then both published at once", async () => {
    const { lender, renter, id } = await completed();
    expect(await noticesFor(renter.id)).toContain("review_open");
    expect(await noticesFor(lender.id)).toContain("review_open");

    // The renter also rates how accurate the listing was.
    await expect(submitReview(renter, review(id))).rejects.toMatchObject({ message: "review_invalid" });
    expect(await submitReview(renter, review(id, { accuracy: "3", comment: "Alt gikk fint." }))).toBe("sealed");

    // The subject sees nothing of the sealed review: not on the page, not on the profile.
    const page = await getReviewPage(lender, id);
    expect(page).toMatchObject({ canWrite: true, mine: null, published: [] });
    expect(await listPublishedReviews(lender.id)).toEqual([]);
    expect((await ratingSummary(lender.id)).count).toBe(0);

    expect(await submitReview(lender, review(id, { comment: "Hyggelig leietaker." }))).toBe("published");
    expect(await statuses(id)).toEqual(["published", "published"]);
    expect(await noticesFor(lender.id)).toContain("review_published");
    expect(await noticesFor(renter.id)).toContain("review_published");
    await expect(submitReview(renter, review(id, { accuracy: "5" }))).rejects.toMatchObject({
      message: "already_reviewed",
    });

    const profile = await getPublicProfile(lender.id);
    expect(profile).toMatchObject({ completedRentals: 1, ratings: { count: 1 } });
    expect(profile!.reviews).toHaveLength(1);
    expect(profile!.reviews[0]).toMatchObject({ comment: "Alt gikk fint.", accuracy: 3, authorName: "Leietaker L." });
    expect(await completedRentalCount(renter.id)).toBe(1);
  });

  it("only the parties of a completed rental; ratings can never be changed afterwards", async () => {
    const { renter, id } = await completed();
    const stranger = await createUser();
    await expect(submitReview(stranger, review(id))).rejects.toMatchObject({ code: "not_found" });
    expect(await getReviewPage(stranger, id)).toBeNull();

    const open = await confirmedBooking(10, 12);
    await expect(submitReview(open.renter, review(open.id, { accuracy: "4" }))).rejects.toMatchObject({
      message: "review_not_open",
    });
    // The database refuses it too.
    await expect(
      owner.insert(schema.reviews).values({
        bookingId: open.id,
        authorId: open.renter.id,
        subjectId: open.lender.id,
        authorRole: "renter",
        ratingCommunication: 5,
        ratingPunctuality: 5,
        ratingAccuracy: 5,
        ratingItemCondition: 5,
        ratingAgreement: 5,
      }),
    ).rejects.toThrow();

    await submitReview(renter, review(id, { accuracy: "4" }));
    const { db } = await import("@/db/client");
    await expect(
      db.execute(sql`UPDATE reviews SET rating_communication = 1 WHERE booking_id = ${id}`),
    ).rejects.toThrow();
    await expect(db.execute(sql`UPDATE reviews SET comment = 'endret' WHERE booking_id = ${id}`)).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM reviews WHERE booking_id = ${id}`)).rejects.toThrow();
  });

  it("the window lapse publishes a single review; an open case holds it until it closes", async () => {
    const a = await completed();
    await submitReview(a.renter, review(a.id, { accuracy: "4" }));
    expect(await publishDueReviews(new Date(Date.now() + 13 * DAY))).toBe(0);
    expect(await publishDueReviews(new Date(Date.now() + 15 * DAY))).toBe(1);
    expect(await publishDueReviews(new Date(Date.now() + 15 * DAY))).toBe(0);
    expect(await statuses(a.id)).toEqual(["published"]);
    await expect(submitReview(a.lender, review(a.id), new Date(Date.now() + 15 * DAY))).rejects.toMatchObject({
      message: "review_window_closed",
    });

    const b = await completed();
    await submitReview(b.renter, review(b.id, { accuracy: "2" }));
    const [d] = await owner
      .insert(schema.disputes)
      .values({
        bookingId: b.id,
        openedBy: b.lender.id,
        respondentId: b.renter.id,
        category: "damaged",
        summary: "Bladet var knekt ved retur.",
        responseDueAt: new Date(Date.now() + 7 * DAY),
      })
      .returning();
    expect(await publishDueReviews(new Date(Date.now() + 15 * DAY))).toBe(0);
    // The case closes today: the window restarts from the closure, so the review waits 14 more days.
    await owner
      .update(schema.disputes)
      .set({ status: "closed_without_agreement", closedAt: new Date() })
      .where(eq(schema.disputes.id, d!.id));
    expect(await publishDueReviews(new Date(Date.now() + 13 * DAY))).toBe(0);
    expect(await publishDueReviews(new Date(Date.now() + 15 * DAY))).toBe(1);
  });

  it("staff remove and restore a review with reasons; the author is told; members cannot", async () => {
    const { lender, renter, id } = await completed();
    await submitReview(renter, review(id, { accuracy: "1", comment: "Personangrep her." }));
    await submitReview(lender, review(id));
    const [r] = await owner
      .select({ id: schema.reviews.id })
      .from(schema.reviews)
      .where(and(eq(schema.reviews.bookingId, id), eq(schema.reviews.authorId, renter.id)));
    const moderator = await createUser({ role: "moderator", staff2fa: true });
    const input = {
      reviewId: r!.id,
      reasonCode: "harassment" as const,
      statement: "Kommentaren inneholder et personangrep.",
    };

    await expect(removeReview(lender, input)).rejects.toMatchObject({ code: "forbidden" });
    expect(await loadReviewForModeration(r!.id)).toMatchObject({
      authorName: "Leietaker L.",
      subjectName: "Utleier U.",
    });

    const { actionId } = await removeReview(moderator, input);
    expect(await listPublishedReviews(lender.id)).toEqual([]);
    const [action] = await owner
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.id, actionId));
    expect(action).toMatchObject({
      targetType: "review",
      targetId: r!.id,
      action: "review_removed",
      actorId: moderator.id,
    });
    expect(await noticesFor(renter.id)).toContain("review_removed");
    const audits = await owner
      .select({ action: schema.auditEvents.action })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.targetId, r!.id));
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(["review.create", "moderation.review_removed"]));
    await expect(removeReview(moderator, input)).rejects.toMatchObject({ code: "conflict" });

    await restoreReview(moderator, { ...input, statement: "Klagen er tatt til følge. Vurderingen er tilbake." });
    expect(await listPublishedReviews(lender.id)).toHaveLength(1);
    expect(await noticesFor(renter.id)).toContain("review_restored");
  });
});
