import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  categorySuggestions,
  conversationParticipants,
  conversations,
  emailOutbox,
  feedback,
  listingImages,
  listings,
  listingUnavailability,
  messages,
  notifications,
  savedListings,
} from "@/db/schema";
import { mediaStore } from "@/modules/media/store";

/**
 * Retention jobs (P03-06, PRIVACY.md §5, SEC-54). Each job deletes exactly what the schedule says and
 * nothing a party still needs; each is safe to run twice. Append-only records go through the
 * SECURITY DEFINER functions in drizzle/0007_retention.sql (fixed periods, so nothing goes early).
 */
const DAY = 24 * 60 * 60 * 1000;
const ago = (now: Date, days: number) => new Date(now.getTime() - days * DAY);
const MONTHS_12 = 365;
const OUTBOX_DAYS = 30;
const DELETED_LISTING_DAYS = 30;

/** Deleted listings: images after 30 days; the row too once nothing refers to it any more. */
export async function purgeDeletedListings(now = new Date()): Promise<number> {
  const due = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.status, "deleted"), lt(listings.deletedAt, ago(now, DELETED_LISTING_DAYS))))
    .limit(500);
  const ids = due.map((r) => r.id);
  if (!ids.length) return 0;
  // The images become orphans and the media clean-up removes the files (media/cleanup.ts).
  await db.delete(listingImages).where(inArray(listingImages.listingId, ids));
  await db.delete(savedListings).where(inArray(savedListings.listingId, ids));
  await db.delete(listingUnavailability).where(inArray(listingUnavailability.listingId, ids));
  const removed = await db.execute<{ id: string }>(sql`
    DELETE FROM listings l
     WHERE l.id IN (${sql.join(
       ids.map((id) => sql`${id}::uuid`),
       sql`, `,
     )})
       AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.listing_id = l.id)
       AND NOT EXISTS (SELECT 1 FROM giveaway_claims g WHERE g.listing_id = l.id)
       AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.listing_id = l.id)
       AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.attached_listing_id = l.id)
    RETURNING l.id`);
  return removed.rows.length;
}

/**
 * Messages 12 months after the last activity, unless a report or a case still refers to them. A
 * conversation without bookings or claims is removed with its last message; one with a booking or a
 * claim stays (the booking refers to it) until that booking or claim is purged.
 */
export async function purgeOldMessages(now = new Date()): Promise<number> {
  const cutoff = ago(now, MONTHS_12);
  const due = await db.execute<{ id: string }>(sql`
    SELECT c.id FROM conversations c
     WHERE c.last_message_at < ${cutoff.toISOString()}::timestamptz
       AND NOT EXISTS (
         SELECT 1 FROM bookings b WHERE b.conversation_id = c.id
            AND (b.status NOT IN ('declined', 'withdrawn', 'expired', 'cancelled', 'completed')
                 OR upper(b.period) >= ${cutoff.toISOString()}::timestamptz))
       AND NOT EXISTS (
         SELECT 1 FROM giveaway_claims g WHERE g.conversation_id = c.id
            AND (g.status IN ('requested', 'selected') OR g.updated_at >= ${cutoff.toISOString()}::timestamptz))
     LIMIT 500`);
  let deleted = 0;
  for (const { id } of due.rows) {
    const removed = await db.execute<{ id: string }>(sql`
      DELETE FROM messages m
       WHERE m.conversation_id = ${id}
         AND NOT EXISTS (SELECT 1 FROM reports r
              WHERE (r.target_type = 'message' AND r.target_id = m.id) OR m.id = ANY (r.attached_message_ids))
         AND NOT EXISTS (SELECT 1 FROM dispute_events e
              WHERE e.reference->>'type' = 'message' AND e.reference->>'id' = m.id::text)
      RETURNING m.id`);
    deleted += removed.rows.length;
    await db.execute(sql`
      DELETE FROM conversation_participants p
       WHERE p.conversation_id = ${id}
         AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = ${id})
         AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.conversation_id = ${id})
         AND NOT EXISTS (SELECT 1 FROM giveaway_claims g WHERE g.conversation_id = ${id})`);
    await db
      .delete(conversations)
      .where(
        and(
          eq(conversations.id, id),
          sql`NOT EXISTS (SELECT 1 FROM ${conversationParticipants} p WHERE p.conversation_id = ${id})`,
          sql`NOT EXISTS (SELECT 1 FROM ${messages} m WHERE m.conversation_id = ${id})`,
        ),
      );
  }
  return deleted;
}

/** Notifications after 12 months; outbox rows 30 days after sending (or after failing for good). */
export async function purgeNotificationsAndOutbox(now = new Date()): Promise<number> {
  const n = await db
    .delete(notifications)
    .where(lt(notifications.createdAt, ago(now, MONTHS_12)))
    .returning({ id: notifications.id });
  const o = await db
    .delete(emailOutbox)
    .where(
      or(
        and(eq(emailOutbox.status, "sent"), lt(emailOutbox.sentAt, ago(now, OUTBOX_DAYS))),
        and(eq(emailOutbox.status, "failed"), lt(emailOutbox.createdAt, ago(now, OUTBOX_DAYS))),
      ),
    )
    .returning({ id: emailOutbox.id });
  return n.length + o.length;
}

export async function purgeCategorySuggestions(now = new Date()): Promise<number> {
  const rows = await db
    .delete(categorySuggestions)
    .where(lt(categorySuggestions.createdAt, ago(now, MONTHS_12)))
    .returning({ id: categorySuggestions.id });
  return rows.length;
}

/** «Gi tilbakemelding» (P04-01): 12 months, handled or not. */
export async function purgeFeedback(now = new Date()): Promise<number> {
  const rows = await db
    .delete(feedback)
    .where(lt(feedback.createdAt, ago(now, MONTHS_12)))
    .returning({ id: feedback.id });
  return rows.length;
}

/**
 * Condition and dispute photos that never got attached within 24 hours, or whose entry or event was
 * purged. The listing scope is handled by media/cleanup.ts.
 */
export async function deleteOrphanPrivateMedia(now = new Date()): Promise<number> {
  const rows = await db.execute<{ storage_key: string; thumb_key: string }>(sql`
    DELETE FROM media_objects m
     WHERE m.created_at < ${ago(now, 1).toISOString()}::timestamptz
       AND ((m.scope = 'condition' AND NOT EXISTS (SELECT 1 FROM condition_photos p WHERE p.media_id = m.id))
         OR (m.scope = 'dispute' AND NOT EXISTS (SELECT 1 FROM dispute_events e WHERE e.media_id = m.id)))
    RETURNING m.storage_key, m.thumb_key`);
  const store = mediaStore();
  for (const r of rows.rows) {
    await store.delete(r.storage_key);
    await store.delete(r.thumb_key);
  }
  return rows.rows.length;
}

/** Append-only records past their retention period (3 years / 2 years), through the definer functions. */
export async function purgeAppendOnly(): Promise<Record<string, number>> {
  const run = async (query: ReturnType<typeof sql>) => {
    const r = await db.execute<{ n: number }>(query);
    return Number(r.rows[0]?.n ?? 0);
  };
  // Cases first: a booking is only purged once no case about it is left.
  return {
    disputes: await run(sql`SELECT purge_closed_disputes() AS n`),
    bookings: await run(sql`SELECT purge_expired_bookings() AS n`),
    claims: await run(sql`SELECT purge_expired_claims() AS n`),
    moderation: await run(sql`SELECT purge_closed_moderation() AS n`),
    legalAcceptances: await run(sql`SELECT purge_legal_acceptances_of_deleted_users() AS n`),
  };
}

/** The daily `retention` job. */
export async function runRetention(now = new Date()) {
  return {
    listings: await purgeDeletedListings(now),
    messages: await purgeOldMessages(now),
    notificationsAndOutbox: await purgeNotificationsAndOutbox(now),
    categorySuggestions: await purgeCategorySuggestions(now),
    feedback: await purgeFeedback(now),
    ...(await purgeAppendOnly()),
    privateMedia: await deleteOrphanPrivateMedia(now),
  };
}
