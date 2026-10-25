import { lt, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { appRateLimits, verifications, workerHeartbeats } from "@/db/schema";
import { releaseStuckEmails, sendDueEmails } from "@/modules/notifications/outbox";
import { deleteOrphanMedia } from "@/modules/media/cleanup";

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
