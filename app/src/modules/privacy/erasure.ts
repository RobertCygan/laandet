import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import {
  accounts,
  auditEvents,
  bookings,
  disputes,
  emailOutbox,
  giveawayClaims,
  identityVerifications,
  listingImages,
  listings,
  listingUnavailability,
  notifications,
  savedListings,
  sessions,
  twoFactors,
  userBlocks,
  userProfiles,
  users,
  verifications,
} from "@/db/schema";
import { formatDate } from "@/i18n/format";
import { localePath } from "@/i18n/page";
import { recordAudit } from "@/modules/audit/audit";
import { env } from "@/modules/config/env";
import { AppError } from "@/modules/errors";
import { queueEmail } from "@/modules/notifications/outbox";
import { announce, moveBooking } from "@/modules/rentals/service";

/**
 * Account erasure (P03-06, PRIVACY.md §6). A `deletion_pending` account is erased as soon as nothing
 * blocks it: no booking under way, no selected giveaway, no open case. What the other party needs as
 * evidence (agreements, condition reports, history, cases, reviews) stays, pseudonymised, until its own
 * retention ends.
 */
const DAY = 24 * 60 * 60 * 1000;
const BLOCKING_BOOKING = [
  "accepted",
  "confirmed",
  "handed_over",
  "return_pending",
  "not_returned",
  "disputed",
] as const;
const OPEN_DISPUTE = ["awaiting_response", "in_negotiation", "support_review", "awaiting_documentation"] as const;
export const DELETED_NAME = "Slettet bruker";
export const INACTIVE_WARNING_DAYS = 2 * 365;
export const INACTIVE_GRACE_DAYS = 60;

/** Why erasure has to wait, or null when it can run. */
export async function erasureBlocker(userId: string): Promise<"booking" | "giveaway" | "case" | null> {
  const [b] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        or(eq(bookings.ownerId, userId), eq(bookings.renterId, userId)),
        inArray(bookings.status, [...BLOCKING_BOOKING]),
      ),
    )
    .limit(1);
  if (b) return "booking";
  const [g] = await db
    .select({ id: giveawayClaims.id })
    .from(giveawayClaims)
    .where(
      and(
        or(eq(giveawayClaims.giverId, userId), eq(giveawayClaims.claimantId, userId)),
        eq(giveawayClaims.status, "selected"),
      ),
    )
    .limit(1);
  if (g) return "giveaway";
  const [d] = await db
    .select({ id: disputes.id })
    .from(disputes)
    .where(
      and(
        or(eq(disputes.openedBy, userId), eq(disputes.respondentId, userId)),
        inArray(disputes.status, [...OPEN_DISPUTE]),
      ),
    )
    .limit(1);
  return d ? "case" : null;
}

/** Open requests to or from the person expire, so nobody waits for an answer that cannot come. */
async function closeOpenRequests(tx: Tx, userId: string) {
  const open = await tx
    .select({ b: bookings, title: listings.title })
    .from(bookings)
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .where(and(or(eq(bookings.ownerId, userId), eq(bookings.renterId, userId)), eq(bookings.status, "requested")))
    .for("update", { of: bookings });
  for (const { b, title } of open) {
    await moveBooking(tx, b, "expire", "system", null);
    await announce(tx, b, "booking.expired", "booking_expired", [b.ownerId === userId ? "renter" : "owner"], title);
  }
  await tx
    .update(giveawayClaims)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        or(eq(giveawayClaims.giverId, userId), eq(giveawayClaims.claimantId, userId)),
        eq(giveawayClaims.status, "requested"),
      ),
    );
}

/** Erases one account now. Throws conflict when something still blocks it. */
export async function eraseAccount(userId: string): Promise<void> {
  const blocker = await erasureBlocker(userId);
  if (blocker) throw new AppError("conflict", `erasure_blocked_${blocker}`);
  const [u] = await db
    .select({ email: users.email, name: users.name, locale: userProfiles.locale, status: userProfiles.status })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, userId));
  if (!u || u.status !== "deletion_pending") throw new AppError("conflict", "not_pending");
  const now = new Date();

  await db.transaction(async (tx) => {
    await closeOpenRequests(tx, userId);

    // Deleted: credentials, sessions, 2FA, identity checks, saved listings, blocks, notifications, outbox.
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.delete(twoFactors).where(eq(twoFactors.userId, userId));
    await tx.delete(verifications).where(or(eq(verifications.identifier, u.email), eq(verifications.value, userId)));
    await tx.delete(identityVerifications).where(eq(identityVerifications.userId, userId));
    await tx.delete(savedListings).where(eq(savedListings.userId, userId));
    await tx.delete(userBlocks).where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(emailOutbox).where(eq(emailOutbox.toUserId, userId));

    // Listings: images always go; the row goes when no rental, claim or conversation refers to it.
    const own = await tx.select({ id: listings.id }).from(listings).where(eq(listings.ownerId, userId));
    const ids = own.map((l) => l.id);
    if (ids.length) {
      await tx.delete(listingImages).where(inArray(listingImages.listingId, ids));
      await tx.delete(listingUnavailability).where(inArray(listingUnavailability.listingId, ids));
      await tx.delete(savedListings).where(inArray(savedListings.listingId, ids));
      await tx
        .update(listings)
        .set({ status: "deleted", deletedAt: now, updatedAt: now })
        .where(and(inArray(listings.id, ids), isNull(listings.deletedAt)));
      await tx.execute(sql`
        DELETE FROM listings l
         WHERE l.owner_id = ${userId}
           AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.listing_id = l.id)
           AND NOT EXISTS (SELECT 1 FROM giveaway_claims g WHERE g.listing_id = l.id)
           AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.listing_id = l.id)
           AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.attached_listing_id = l.id)`);
    }

    // The confirmation goes out before the address is removed (not linked to the account any more).
    await queueEmail(tx, {
      toEmail: u.email,
      toUserId: null,
      template: "account_erased",
      locale: u.locale,
      payload: { name: u.name },
    });

    // Replaced: name, email; the profile is emptied and marked deleted.
    await tx
      .update(userProfiles)
      .set({
        status: "deleted",
        role: "user",
        bio: null,
        localityId: null,
        deletedAt: now,
        statusChangedAt: now,
        updatedAt: now,
      })
      .where(eq(userProfiles.userId, userId));
    await tx
      .update(users)
      .set({
        name: DELETED_NAME,
        email: `deleted+${userId}@invalid`,
        emailVerified: false,
        image: null,
        twoFactorEnabled: false,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
    await recordAudit(tx, { action: "privacy.account_erased", targetType: "user", targetId: userId });
  });
}

/** Worker `account_erasure`: every pending account that nothing blocks any more. */
export async function eraseDueAccounts(): Promise<number> {
  const pending = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.status, "deletion_pending"))
    .limit(200);
  let erased = 0;
  for (const { userId } of pending) {
    try {
      await eraseAccount(userId);
      erased++;
    } catch (err) {
      if (err instanceof AppError && err.code === "conflict") continue; // still blocked, or changed
      throw err;
    }
  }
  return erased;
}

/**
 * Worker `inactive_accounts` (PRIVACY §5): a warning after 24 months without sign-in, erasure 60 days
 * later if the person still has not signed in. Sign-ins are read from the audit log.
 */
export async function handleInactiveAccounts(now = new Date()): Promise<{ warned: number; scheduled: number }> {
  const since = new Date(now.getTime() - INACTIVE_WARNING_DAYS * DAY);
  const signIn = (userId: unknown, after: unknown) => sql`EXISTS (
    SELECT 1 FROM ${auditEvents} a WHERE a.actor_id = ${userId} AND a.action = 'auth.sign_in' AND a.occurred_at >= ${after})`;
  const warnedSince = (userId: unknown, after: unknown) => sql`EXISTS (
    SELECT 1 FROM ${auditEvents} a WHERE a.target_id = ${userId} AND a.action = 'privacy.inactivity_warning'
       AND a.occurred_at >= ${after})`;

  // 1. Warn: old enough, no sign-in for 24 months, not warned in that time.
  const toWarn = await db
    .select({ id: users.id, email: users.email, name: users.name, locale: userProfiles.locale })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        inArray(userProfiles.status, ["active", "restricted"]),
        lt(users.createdAt, since),
        sql`NOT ${signIn(users.id, since.toISOString())}`,
        sql`NOT ${warnedSince(users.id, since.toISOString())}`,
      ),
    )
    .limit(200);
  for (const u of toWarn) {
    const deadline = new Date(now.getTime() + INACTIVE_GRACE_DAYS * DAY);
    await db.transaction(async (tx) => {
      await queueEmail(tx, {
        toEmail: u.email,
        toUserId: u.id,
        template: "inactivity_warning",
        locale: u.locale,
        payload: {
          name: u.name,
          date: formatDate(deadline),
          url: `${env().APP_URL}${localePath(u.locale, "/logg-inn")}`,
        },
      });
      await recordAudit(tx, { action: "privacy.inactivity_warning", targetType: "user", targetId: u.id });
    });
  }

  // 2. Schedule erasure: warned at least 60 days ago (within this inactivity period) and still no sign-in.
  const graceEnd = new Date(now.getTime() - INACTIVE_GRACE_DAYS * DAY).toISOString();
  const toDelete = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        inArray(userProfiles.status, ["active", "restricted"]),
        lt(users.createdAt, since),
        sql`EXISTS (SELECT 1 FROM ${auditEvents} w WHERE w.target_id = ${users.id}
              AND w.action = 'privacy.inactivity_warning' AND w.occurred_at < ${graceEnd}
              AND w.occurred_at >= ${since.toISOString()}
              AND NOT EXISTS (SELECT 1 FROM ${auditEvents} s WHERE s.actor_id = ${users.id}
                    AND s.action = 'auth.sign_in' AND s.occurred_at >= w.occurred_at))`,
      ),
    )
    .limit(200);
  for (const u of toDelete) {
    await db.transaction(async (tx) => {
      await tx
        .update(userProfiles)
        .set({ status: "deletion_pending", deletionRequestedAt: now, statusChangedAt: now, updatedAt: now })
        .where(and(eq(userProfiles.userId, u.id), inArray(userProfiles.status, ["active", "restricted"])));
      await tx
        .update(listings)
        .set({ status: "archived", updatedAt: now })
        .where(
          and(
            eq(listings.ownerId, u.id),
            inArray(listings.status, ["published", "paused", "draft"]),
            isNull(listings.deletedAt),
          ),
        );
      await tx.delete(sessions).where(eq(sessions.userId, u.id));
      await recordAudit(tx, { action: "privacy.inactivity_deletion", targetType: "user", targetId: u.id });
    });
  }
  return { warned: toWarn.length, scheduled: toDelete.length };
}
