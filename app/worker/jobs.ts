import { lt, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { appRateLimits, verifications, workerHeartbeats } from "@/db/schema";
import { releaseStuckEmails, sendDueEmails } from "@/modules/notifications/outbox";
import { deleteOrphanMedia } from "@/modules/media/cleanup";
import { expireClaims } from "@/modules/giveaways/jobs";
import {
  expireAgreements,
  expireBookingRequests,
  lapseHandovers,
  lapseReturns,
  sendReturnReminders,
} from "@/modules/rentals/jobs";
import { sendMessageEmails } from "@/modules/messaging/email-batch";
import { expireRestrictions } from "@/modules/moderation/users";
import { eraseDueAccounts, handleInactiveAccounts } from "@/modules/privacy/erasure";
import { deleteOrphanPrivateMedia, runRetention } from "@/modules/privacy/retention";
import { publishDueReviews } from "@/modules/reviews/service";

export type Job = { name: string; everySeconds: number; run: (db: DbOrTx) => Promise<unknown> };

/** Idempotent jobs; safe to run twice or concurrently (ARCHITECTURE.md §4.11). */
export const JOBS: Job[] = [
  { name: "email_outbox", everySeconds: 0, run: (db) => sendDueEmails(db) },
  { name: "email_release_stuck", everySeconds: 600, run: (db) => releaseStuckEmails(db) },
  {
    name: "rate_limit_cleanup",
    everySeconds: 3600,
    run: (db) => db.delete(appRateLimits).where(lt(appRateLimits.windowEnd, sql`now() - interval '1 hour'`)),
  },
  {
    name: "auth_cleanup",
    everySeconds: 3600,
    run: async (db) => {
      await db.execute(sql`DELETE FROM sessions WHERE expires_at < now()`);
      await db.delete(verifications).where(lt(verifications.expiresAt, sql`now() - interval '7 days'`));
    },
  },
  { name: "orphan_media", everySeconds: 3600, run: (db) => deleteOrphanMedia(db) },
  { name: "message_email_batch", everySeconds: 60, run: (db) => sendMessageEmails(db) },
  // Phase 02 time-based steps (P02-06). They use the shared connection and lock row by row.
  { name: "booking_request_expiry", everySeconds: 300, run: () => expireBookingRequests() },
  { name: "agreement_expiry", everySeconds: 300, run: () => expireAgreements() },
  { name: "handover_lapse", everySeconds: 900, run: () => lapseHandovers() },
  { name: "return_lapse", everySeconds: 900, run: () => lapseReturns() },
  { name: "return_reminder", everySeconds: 900, run: () => sendReturnReminders() },
  { name: "giveaway_claim_expiry", everySeconds: 3600, run: () => expireClaims() },
  // Phase 03: time-limited account restrictions end by themselves (P03-03).
  { name: "restriction_expiry", everySeconds: 3600, run: () => expireRestrictions() },
  // Phase 03: reviews, retention and erasure (P03-02, P03-06).
  { name: "review_publish", everySeconds: 900, run: () => publishDueReviews() },
  { name: "orphan_private_media", everySeconds: 3600, run: () => deleteOrphanPrivateMedia() },
  { name: "account_erasure", everySeconds: 3600, run: () => eraseDueAccounts() },
  { name: "retention", everySeconds: 24 * 3600, run: () => runRetention() },
  { name: "inactive_accounts", everySeconds: 24 * 3600, run: () => handleInactiveAccounts() },
  {
    name: "audit_retention",
    everySeconds: 24 * 3600,
    run: (db) => db.execute(sql`SELECT purge_expired_audit_events()`),
  },
];

export async function runJob(db: DbOrTx, job: Job): Promise<void> {
  const now = new Date();
  try {
    await job.run(db);
    await db
      .insert(workerHeartbeats)
      .values({ job: job.name, lastRunAt: now, lastOkAt: now, lastError: null })
      .onConflictDoUpdate({ target: workerHeartbeats.job, set: { lastRunAt: now, lastOkAt: now, lastError: null } });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : "failed";
    console.error(`[worker] ${job.name} failed:`, err);
    await db
      .insert(workerHeartbeats)
      .values({ job: job.name, lastRunAt: now, lastError: message })
      .onConflictDoUpdate({ target: workerHeartbeats.job, set: { lastRunAt: now, lastError: message } });
  }
}
