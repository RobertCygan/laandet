import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db, type DbOrTx, type Tx } from "@/db/client";
import { bookings, disputes, listings, moderationActions, reports, reviews, userProfiles, users } from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { AppError } from "@/modules/errors";
import { notify } from "@/modules/notifications/notify";
import { loadBookingFor } from "@/modules/rentals/service";
import { getRequestMeta } from "@/modules/server/request-meta";

/**
 * Two-sided, double-blind reviews of completed rentals (P03-02, D-014). A review stays sealed until both
 * have written or the window ends; an open dispute on the booking holds publication until it closes.
 */
export const REVIEW_WINDOW_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;
const OPEN_DISPUTE = ["awaiting_response", "in_negotiation", "support_review", "awaiting_documentation"] as const;

type BookingRow = typeof bookings.$inferSelect;

const rating = z.coerce.number({ error: "required" }).int().min(1, { error: "required" }).max(5);
export const reviewSchema = z.object({
  bookingId: z.uuid(),
  communication: rating,
  punctuality: rating,
  itemCondition: rating,
  agreement: rating,
  accuracy: rating.optional().or(z.literal("").transform(() => undefined)),
  comment: z
    .string()
    .trim()
    .max(1000, { error: "too_long" })
    .optional()
    .transform((v) => (v ? v : null)),
});

/** The review window: 14 days after completion, restarting when a later case on the booking closes. */
async function windowEnd(conn: DbOrTx, b: BookingRow): Promise<Date | null> {
  if (!b.completedAt) return null;
  const [d] = await conn
    .select({ closed: sql<Date | null>`max(${disputes.closedAt})` })
    .from(disputes)
    .where(eq(disputes.bookingId, b.id));
  const closed = d?.closed ? new Date(d.closed) : null;
  const from = closed && closed > b.completedAt ? closed : b.completedAt;
  return new Date(from.getTime() + REVIEW_WINDOW_DAYS * DAY);
}

async function hasOpenDispute(conn: DbOrTx, bookingId: string): Promise<boolean> {
  const [d] = await conn
    .select({ id: disputes.id })
    .from(disputes)
    .where(and(eq(disputes.bookingId, bookingId), inArray(disputes.status, [...OPEN_DISPUTE])));
  return Boolean(d);
}

/** Everything the review page needs for one party. Never the other party's sealed review. */
export async function getReviewPage(actor: Actor, bookingId: string, now = new Date()) {
  let b: BookingRow;
  try {
    b = await loadBookingFor(actor, bookingId, "booking.view");
  } catch {
    return null;
  }
  const me = (actor as UserActor).id;
  const role: "owner" | "renter" = b.ownerId === me ? "owner" : "renter";
  const otherId = role === "owner" ? b.renterId : b.ownerId;
  const [[l], [other], rows, end] = await Promise.all([
    db.select({ title: listings.title }).from(listings).where(eq(listings.id, b.listingId)),
    db.select({ name: users.name }).from(users).where(eq(users.id, otherId)),
    db.select().from(reviews).where(eq(reviews.bookingId, b.id)),
    windowEnd(db, b),
  ]);
  const mine = rows.find((r) => r.authorId === me) ?? null;
  const published = rows.filter((r) => r.status === "published");
  const open = b.status === "completed" && !!end && now < end && !mine;
  return {
    meId: me,
    bookingId: b.id,
    bookingStatus: b.status,
    title: l?.title ?? "",
    role,
    otherName: other?.name ?? "",
    windowEnd: end,
    canWrite: open,
    mine,
    published,
  };
}

/** Submit one's own review once; publishes both at once when the second arrives and no case is open. */
export async function submitReview(
  actor: Actor,
  input: z.infer<typeof reviewSchema>,
  now = new Date(),
): Promise<"sealed" | "published"> {
  const b = await loadBookingFor(actor, input.bookingId, "booking.view");
  assertCan(actor, "review.write", { type: "booking", ownerId: b.ownerId, renterId: b.renterId });
  if (b.status !== "completed") throw new AppError("conflict", "review_not_open");
  const end = await windowEnd(db, b);
  if (!end || now >= end) throw new AppError("conflict", "review_window_closed");
  const role: "owner" | "renter" = b.ownerId === actor.id ? "owner" : "renter";
  if (role === "renter" && input.accuracy === undefined) {
    throw new AppError("validation", "review_invalid", { fieldErrors: { accuracy: "required" } });
  }
  const meta = await getRequestMeta();
  try {
    return await db.transaction(async (tx) => {
      const [r] = await tx
        .insert(reviews)
        .values({
          bookingId: b.id,
          authorId: actor.id,
          subjectId: role === "owner" ? b.renterId : b.ownerId,
          authorRole: role,
          ratingCommunication: input.communication,
          ratingPunctuality: input.punctuality,
          ratingItemCondition: input.itemCondition,
          ratingAgreement: input.agreement,
          ratingAccuracy: role === "renter" ? (input.accuracy ?? null) : null,
          comment: input.comment,
        })
        .returning({ id: reviews.id });
      await recordAudit(tx, {
        actorId: actor.id,
        action: "review.create",
        targetType: "review",
        targetId: r!.id,
        meta,
      });
      return (await publishBooking(tx, b, now, false)) ? "published" : "sealed";
    });
  } catch (err) {
    if ((err as { cause?: { code?: string } }).cause?.code === "23505")
      throw new AppError("conflict", "already_reviewed");
    throw err;
  }
}

/**
 * Publishes the sealed reviews of one booking when both are written or the window has ended, and no
 * case is open. Returns whether anything was published.
 */
async function publishBooking(tx: Tx, b: BookingRow, now: Date, windowMayEnd: boolean): Promise<boolean> {
  const rows = await tx.select().from(reviews).where(eq(reviews.bookingId, b.id)).for("update");
  const sealed = rows.filter((r) => r.status === "sealed");
  if (!sealed.length) return false;
  const both = rows.length >= 2;
  const end = await windowEnd(tx, b);
  const lapsed = windowMayEnd && !!end && now >= end;
  if (!both && !lapsed) return false;
  if (await hasOpenDispute(tx, b.id)) return false;
  await tx
    .update(reviews)
    .set({ status: "published", publishedAt: now })
    .where(
      and(
        eq(reviews.bookingId, b.id),
        eq(reviews.status, "sealed"),
        inArray(
          reviews.id,
          sealed.map((r) => r.id),
        ),
      ),
    );
  const [l] = await tx.select({ title: listings.title }).from(listings).where(eq(listings.id, b.listingId));
  for (const userId of new Set(sealed.map((r) => r.subjectId))) {
    await notify(tx, {
      userId,
      kind: "review_published",
      title: l?.title ?? "",
      path: `/leieforhold/${b.id}/vurdering`,
      email: "optional",
    });
  }
  return true;
}

/** Worker `review_publish`: sealed reviews whose window has ended (or whose case has closed). */
export async function publishDueReviews(now = new Date()): Promise<number> {
  const due = await db
    .selectDistinct({ bookingId: reviews.bookingId })
    .from(reviews)
    .where(eq(reviews.status, "sealed"))
    .limit(500);
  let done = 0;
  for (const { bookingId } of due) {
    const published = await db.transaction(async (tx) => {
      const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
      return b ? publishBooking(tx, b, now, true) : false;
    });
    if (published) done++;
  }
  return done;
}

/** «Du kan nå vurdere …»: called in the same transaction that completes a booking. */
export async function inviteReviews(tx: Tx, b: { id: string; ownerId: string; renterId: string }, title: string) {
  for (const userId of [b.ownerId, b.renterId]) {
    await notify(tx, {
      userId,
      kind: "review_open",
      title,
      path: `/leieforhold/${b.id}/vurdering`,
      email: "optional",
    });
  }
}

// ---------------------------------------------------------------- profile

const authorUser = alias(users, "review_author");
const authorProfile = alias(userProfiles, "review_author_profile");

/** Published reviews about a person, newest first. A deleted author is shown as «Tidligere medlem». */
export async function listPublishedReviews(subjectId: string, limit = 50) {
  const rows = await db
    .select({
      id: reviews.id,
      authorRole: reviews.authorRole,
      communication: reviews.ratingCommunication,
      punctuality: reviews.ratingPunctuality,
      accuracy: reviews.ratingAccuracy,
      itemCondition: reviews.ratingItemCondition,
      agreement: reviews.ratingAgreement,
      comment: reviews.comment,
      publishedAt: reviews.publishedAt,
      authorName: authorUser.name,
      authorStatus: authorProfile.status,
    })
    .from(reviews)
    .innerJoin(authorUser, eq(authorUser.id, reviews.authorId))
    .innerJoin(authorProfile, eq(authorProfile.userId, reviews.authorId))
    .where(and(eq(reviews.subjectId, subjectId), eq(reviews.status, "published")))
    .orderBy(desc(reviews.publishedAt))
    .limit(limit);
  return rows.map(({ authorStatus, authorName, ...r }) => ({
    ...r,
    authorName: authorStatus === "deleted" ? null : authorName,
  }));
}

export type RatingSummary = { key: RatingKey; average: number; count: number };
export const RATING_KEYS = ["communication", "punctuality", "accuracy", "itemCondition", "agreement"] as const;
type RatingKey = (typeof RATING_KEYS)[number];

/** Averages per criterion over all published reviews (one decimal), with how many reviews each covers. */
export async function ratingSummary(subjectId: string): Promise<{ count: number; ratings: RatingSummary[] }> {
  const [r] = await db
    .select({
      count: sql<number>`count(*)::int`,
      communication: sql<string | null>`avg(${reviews.ratingCommunication})`,
      punctuality: sql<string | null>`avg(${reviews.ratingPunctuality})`,
      accuracy: sql<string | null>`avg(${reviews.ratingAccuracy})`,
      accuracyCount: sql<number>`count(${reviews.ratingAccuracy})::int`,
      itemCondition: sql<string | null>`avg(${reviews.ratingItemCondition})`,
      agreement: sql<string | null>`avg(${reviews.ratingAgreement})`,
    })
    .from(reviews)
    .where(and(eq(reviews.subjectId, subjectId), eq(reviews.status, "published")));
  const count = Number(r?.count ?? 0);
  const round = (v: string | null) => Math.round(Number(v) * 10) / 10;
  const ratings: RatingSummary[] = RATING_KEYS.flatMap((key) => {
    const value = r?.[key];
    const n = key === "accuracy" ? Number(r?.accuracyCount ?? 0) : count;
    return value === null || value === undefined || n === 0 ? [] : [{ key, average: round(value), count: n }];
  });
  return { count, ratings };
}

/** Completed rentals as owner or renter: a real, verifiable number (master spec §8). */
export async function completedRentalCount(userId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(eq(bookings.status, "completed"), sql`(${bookings.ownerId} = ${userId} OR ${bookings.renterId} = ${userId})`),
    );
  return Number(r?.n ?? 0);
}

// ---------------------------------------------------------------- moderation (wired into the queue in P03-03)

export const reviewModerationSchema = z.object({
  reviewId: z.uuid(),
  reportId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  reasonCode: z.enum(["fake_review", "harassment", "privacy", "illegal_content", "misleading", "other"]),
  statement: z.string().trim().min(10, { error: "statement_too_short" }).max(4000, { error: "too_long" }),
});

const subjectUser = alias(users, "review_subject");

/** The review as staff see it in the queue, or null. */
export async function loadReviewForModeration(reviewId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(reviewId)) return null;
  const [r] = await db
    .select({
      id: reviews.id,
      bookingId: reviews.bookingId,
      authorId: reviews.authorId,
      subjectId: reviews.subjectId,
      status: reviews.status,
      comment: reviews.comment,
      authorName: authorUser.name,
      subjectName: subjectUser.name,
    })
    .from(reviews)
    .innerJoin(authorUser, eq(authorUser.id, reviews.authorId))
    .innerJoin(subjectUser, eq(subjectUser.id, reviews.subjectId))
    .where(eq(reviews.id, reviewId));
  return r ?? null;
}

async function moderateReview(
  actor: Actor,
  input: z.infer<typeof reviewModerationSchema>,
  op: "remove" | "restore",
): Promise<{ actionId: string }> {
  const r = await loadReviewForModeration(input.reviewId);
  if (!r) throw new AppError("not_found");
  assertCan(actor, "review.moderate", { type: "review", authorId: r.authorId, subjectId: r.subjectId });
  if (op === "remove" ? r.status !== "published" && r.status !== "sealed" : r.status !== "removed")
    throw new AppError("conflict", "review_changed");
  if (input.reportId) {
    const [rep] = await db.select().from(reports).where(eq(reports.id, input.reportId));
    if (!rep || rep.targetType !== "review" || rep.targetId !== r.id) throw new AppError("not_found");
    if (rep.reporterId === actor.id) throw new AppError("forbidden");
  }
  const [l] = await db
    .select({ title: listings.title })
    .from(bookings)
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .where(eq(bookings.id, r.bookingId));
  const meta = await getRequestMeta();
  const action = op === "remove" ? "review_removed" : "review_restored";
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(reviews)
      // A review removed before publication goes back to sealed; the normal publication rules apply again.
      .set({
        status:
          op === "remove"
            ? "removed"
            : sql<"sealed" | "published">`CASE WHEN ${reviews.publishedAt} IS NULL THEN 'sealed' ELSE 'published' END`,
      })
      .where(and(eq(reviews.id, r.id), eq(reviews.status, r.status)))
      .returning({ id: reviews.id });
    if (!updated.length) throw new AppError("conflict", "review_changed");
    const [a] = await tx
      .insert(moderationActions)
      .values({
        actorId: actor.id,
        targetType: "review",
        targetId: r.id,
        action,
        reasonCode: input.reasonCode,
        statementOfReasons: input.statement,
        reportId: input.reportId ?? null,
      })
      .returning({ id: moderationActions.id });
    if (op === "remove") {
      // Every open report about this review is handled by the same decision.
      await tx
        .update(reports)
        .set({ status: "actioned", handledBy: actor.id, handledAt: new Date(), decisionNote: action })
        .where(
          and(
            eq(reports.targetType, "review"),
            eq(reports.targetId, r.id),
            inArray(reports.status, ["open", "in_review"]),
          ),
        );
    }
    await notify(tx, {
      userId: r.authorId,
      kind: action,
      title: l?.title ?? "",
      path: `/moderering/${a!.id}`,
      email: "essential",
    });
    await recordAudit(tx, {
      actorId: actor.id,
      actorRole: (actor as UserActor).role,
      action: `moderation.${action}`,
      targetType: "review",
      targetId: r.id,
      reason: input.reasonCode,
      metadata: { moderationActionId: a!.id, reportId: input.reportId ?? null },
      meta,
    });
    return { actionId: a!.id };
  });
}

/** Staff remove a review with a statement of reasons; the author is told and can appeal. */
export function removeReview(actor: Actor, input: z.infer<typeof reviewModerationSchema>) {
  return moderateReview(actor, input, "remove");
}

/** Staff restore a removed review (for example after a successful appeal). */
export function restoreReview(actor: Actor, input: z.infer<typeof reviewModerationSchema>) {
  return moderateReview(actor, input, "restore");
}
