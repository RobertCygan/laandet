import { and, count, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  appeals,
  auditEvents,
  bookings,
  disputes,
  emailOutbox,
  giveawayClaims,
  listings,
  reports,
  userProfiles,
  workerHeartbeats,
} from "@/db/schema";
import type { Actor } from "@/modules/authz/actor-types";
import { assertCan } from "@/modules/authz/policy";
import { JOBS } from "../../../worker/jobs";

const DAY = 24 * 60 * 60 * 1000;
/** The worker loop runs every minute; a job counts as late after twice its interval (at least 5 minutes). */
const lateAfterMs = (everySeconds: number) => Math.max(2 * everySeconds * 1000, 5 * 60 * 1000);

async function byStatus(table: PgTable, status: PgColumn, where?: SQL) {
  const rows = await db
    .select({ status: sql<string>`${status}`, n: count() })
    .from(table)
    .where(where)
    .groupBy(status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
}

/**
 * Operations overview for all staff (P03-04): counts only, never personal data or message text.
 * `now` is injectable for tests.
 */
export async function getMetrics(actor: Actor, now = new Date()) {
  assertCan(actor, "metrics.view");
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const [users, listingsByStatus, bookingsByStatus, claimsByStatus, disputesByStatus, outbox] = await Promise.all([
    byStatus(userProfiles, userProfiles.status),
    byStatus(listings, listings.status, eq(listings.isDemo, false)),
    byStatus(bookings, bookings.status),
    byStatus(giveawayClaims, giveawayClaims.status),
    byStatus(disputes, disputes.status),
    byStatus(emailOutbox, emailOutbox.status, inArray(emailOutbox.status, ["pending", "sending", "failed"])),
  ]);
  const [openReports, [openAppeals], [sentThisWeek], rateLimited, heartbeats] = await Promise.all([
    db
      .select({ targetType: reports.targetType, n: count() })
      .from(reports)
      .where(inArray(reports.status, ["open", "in_review"]))
      .groupBy(reports.targetType),
    db.select({ n: count() }).from(appeals).where(eq(appeals.status, "open")),
    db
      .select({ n: count() })
      .from(emailOutbox)
      .where(and(eq(emailOutbox.status, "sent"), gte(emailOutbox.sentAt, weekAgo))),
    // Rate-limit hits are audited as `auth.rate_limited` (sign-in) and `abuse.rate_limited` (app limits).
    db
      .select({ action: auditEvents.action, n: count() })
      .from(auditEvents)
      .where(
        and(
          inArray(auditEvents.action, ["auth.rate_limited", "abuse.rate_limited"]),
          gte(auditEvents.occurredAt, weekAgo),
        ),
      )
      .groupBy(auditEvents.action),
    db.select().from(workerHeartbeats),
  ]);

  const jobs = JOBS.map((job) => {
    const hb = heartbeats.find((h) => h.job === job.name);
    const late = !hb || now.getTime() - hb.lastRunAt.getTime() > lateAfterMs(job.everySeconds);
    const failing = !!hb && (hb.lastError !== null || !hb.lastOkAt || hb.lastOkAt < hb.lastRunAt);
    return {
      name: job.name,
      everySeconds: job.everySeconds,
      lastRunAt: hb?.lastRunAt ?? null,
      lastOkAt: hb?.lastOkAt ?? null,
      // Truncated: an error text is for spotting the problem; details are in the server log.
      lastError: hb?.lastError ? hb.lastError.slice(0, 200) : null,
      late,
      failing,
    };
  });

  return {
    users,
    listings: listingsByStatus,
    bookings: bookingsByStatus,
    claims: claimsByStatus,
    disputes: disputesByStatus,
    openReports: Object.fromEntries(openReports.map((r) => [r.targetType, r.n])) as Record<string, number>,
    openAppeals: openAppeals?.n ?? 0,
    outbox: {
      pending: outbox.pending ?? 0,
      sending: outbox.sending ?? 0,
      failed: outbox.failed ?? 0,
      sentLast7Days: sentThisWeek?.n ?? 0,
    },
    rateLimited: Object.fromEntries(rateLimited.map((r) => [r.action, r.n])) as Record<string, number>,
    jobs,
  };
}

export type Metrics = Awaited<ReturnType<typeof getMetrics>>;
