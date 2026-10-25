import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workerHeartbeats } from "@/db/schema";
import { env } from "@/modules/config/env";
import { formatDateTime } from "@/i18n/format";
import { queueEmail } from "@/modules/notifications/outbox";

const HOUR = 60 * 60 * 1000;
/** A job is failing after three failed runs in a row, or overdue after three missed intervals. */
export const ALERT_AFTER_FAILURES = 3;
const OVERDUE_FACTOR = 3;
/** The worker loop runs every minute; short jobs count as overdue only after 15 minutes. */
const MIN_INTERVAL_SECONDS = 300;
/** One reminder every 6 hours while a job stays broken, and one email when it recovers. */
export const ALERT_REPEAT_MS = 6 * HOUR;

export type JobState = "ok" | "failing" | "overdue";

export function jobState(h: { failCount: number; lastRunAt: Date }, everySeconds: number, now: Date): JobState {
  if (h.failCount >= ALERT_AFTER_FAILURES) return "failing";
  const allowedMs = Math.max(everySeconds, MIN_INTERVAL_SECONDS) * OVERDUE_FACTOR * 1000;
  return now.getTime() - h.lastRunAt.getTime() > allowedMs ? "overdue" : "ok";
}

/**
 * Worker job `ops_alerts` (P04-04): emails `OPS_ALERT_EMAIL` when a job needs attention and when it recovers.
 * The email carries the job name, the state, the last run and the already redacted error; never personal data.
 * A dead worker cannot report itself: the external uptime monitor watches `/healthz?worker=1` for that.
 */
export async function checkOpsAlerts(
  intervals: Record<string, number>,
  now = new Date(),
  to = env().OPS_ALERT_EMAIL,
): Promise<number> {
  if (!to) return 0;
  const rows = await db.select().from(workerHeartbeats);
  let sent = 0;
  for (const h of rows) {
    const every = intervals[h.job];
    if (every === undefined) continue; // a job that no longer exists
    const state = jobState(h, every, now);
    const remind = !h.alerting || !h.alertedAt || now.getTime() - h.alertedAt.getTime() >= ALERT_REPEAT_MS;
    if (state !== "ok" && !remind) continue;
    if (state === "ok" && !h.alerting) continue;
    await db.transaction(async (tx) => {
      const changed = await tx
        .update(workerHeartbeats)
        .set(state === "ok" ? { alerting: false, alertedAt: null } : { alerting: true, alertedAt: now })
        .where(and(eq(workerHeartbeats.job, h.job), eq(workerHeartbeats.alerting, h.alerting)))
        .returning({ job: workerHeartbeats.job });
      if (!changed.length) return; // another run got there first
      await queueEmail(tx, {
        toEmail: to,
        template: "ops_alert",
        locale: "en",
        payload: {
          job: h.job,
          state: state === "ok" ? "recovered" : state,
          lastRun: formatDateTime(h.lastRunAt, "en"),
          error: state === "ok" ? "" : (h.lastError ?? ""),
        },
      });
      sent++;
    });
  }
  return sent;
}
