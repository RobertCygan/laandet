import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { conversationParticipants } from "@/db/schema";
import { localePath } from "@/i18n/page";
import { env } from "@/modules/config/env";
import { queueEmail } from "@/modules/notifications/outbox";

/** At most one email per conversation and recipient in this window (ARCHITECTURE §4.7). */
export const MESSAGE_EMAIL_WINDOW_MINUTES = 15;
/** Give someone who is reading live a moment before emailing them. */
export const MESSAGE_EMAIL_MIN_AGE_MINUTES = 2;

type Candidate = {
  conversation_id: string;
  user_id: string;
  email: string;
  name: string;
  locale: "nb" | "en";
  title: string;
};

/**
 * Worker job `message_email_batch`: for each participant with unread messages from the other party,
 * queue one short notice with a link — never the message text — and remember when. Recipients who
 * turned email notifications off get none. Safe to run twice or concurrently: the claim on
 * `last_emailed_at` is a conditional update.
 */
export async function sendMessageEmails(db: DbOrTx, now: Date = new Date()): Promise<number> {
  const windowStart = new Date(now.getTime() - MESSAGE_EMAIL_WINDOW_MINUTES * 60_000);
  const newestAllowed = new Date(now.getTime() - MESSAGE_EMAIL_MIN_AGE_MINUTES * 60_000);
  const { rows } = await db.execute<Candidate>(sql`
    SELECT cp.conversation_id, cp.user_id, u.email, u.name, up.locale, l.title
    FROM conversation_participants cp
    JOIN users u ON u.id = cp.user_id
    JOIN user_profiles up ON up.user_id = cp.user_id
    JOIN conversations c ON c.id = cp.conversation_id
    JOIN listings l ON l.id = c.listing_id
    WHERE up.email_notifications
      AND up.status IN ('active', 'restricted')
      AND cp.archived_at IS NULL
      AND (cp.last_emailed_at IS NULL OR cp.last_emailed_at < ${windowStart.toISOString()}::timestamptz)
      AND EXISTS (
        SELECT 1 FROM messages m
        WHERE m.conversation_id = cp.conversation_id
          AND m.kind = 'user'
          AND m.sender_id <> cp.user_id
          AND m.redacted_at IS NULL
          AND m.created_at > coalesce(cp.last_read_at, 'epoch'::timestamptz)
          AND m.created_at > coalesce(cp.last_emailed_at, 'epoch'::timestamptz)
          AND m.created_at <= ${newestAllowed.toISOString()}::timestamptz
      )
    LIMIT 200`);

  let sent = 0;
  for (const r of rows) {
    // Claim and queue together, so a notice is never lost or sent twice.
    const queued = await db.transaction(async (tx) => {
      const claimed = await tx
        .update(conversationParticipants)
        .set({ lastEmailedAt: now })
        .where(
          and(
            eq(conversationParticipants.conversationId, r.conversation_id),
            eq(conversationParticipants.userId, r.user_id),
            sql`(${conversationParticipants.lastEmailedAt} IS NULL OR ${conversationParticipants.lastEmailedAt} < ${windowStart.toISOString()}::timestamptz)`,
          ),
        )
        .returning({ id: conversationParticipants.userId });
      if (!claimed.length) return false;
      await queueEmail(tx, {
        toEmail: r.email,
        toUserId: r.user_id,
        template: "activity",
        locale: r.locale,
        payload: {
          name: r.name,
          kind: "new_message",
          title: r.title.slice(0, 120),
          url: `${env().APP_URL}${localePath(r.locale, `/meldinger/${r.conversation_id}`)}`,
        },
      });
      return true;
    });
    if (queued) sent++;
  }
  return sent;
}
