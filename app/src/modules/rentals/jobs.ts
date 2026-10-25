import { and, eq, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { bookings, conditionReports, listings } from "@/db/schema";
import { closeLiveContract } from "@/modules/contracts/service";
import { CONDITION_DEADLINES, decisions, proposedOutcome } from "@/modules/condition/service";
import { AppError } from "@/modules/errors";
import { notify } from "@/modules/notifications/notify";
import { announce, moveBooking } from "./service";

/**
 * Time-based booking steps (P02-06, DATA_MODEL §5, CONDITION_REPORTS §7). Each job picks due rows,
 * then handles each one in its own transaction with a row lock and a status-conditional update, so a
 * job running twice (or next to a user acting on the same booking) never moves a booking twice.
 * Every transition is written to booking_events with actor_id NULL (system).
 */
const BATCH = 200;
const HOUR = 60 * 60 * 1000;
type BookingRow = typeof bookings.$inferSelect;

const at = (d: Date) => sql`${d.toISOString()}::timestamptz`;

async function dueBookings(where: SQL): Promise<string[]> {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(where)
    .orderBy(bookings.createdAt)
    .limit(BATCH);
  return rows.map((r) => r.id);
}

/**
 * Runs `fn` for each booking in its own transaction, with the row locked and its status re-checked.
 * Rows that changed in the meantime are skipped. Other errors are reported after the batch.
 */
async function eachBooking(
  ids: string[],
  status: BookingRow["status"],
  fn: (tx: Tx, b: BookingRow, title: string) => Promise<boolean>,
): Promise<number> {
  let done = 0;
  let failure: unknown = null;
  for (const id of ids) {
    try {
      const moved = await db.transaction(async (tx) => {
        const [b] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update", { skipLocked: true });
        if (!b || b.status !== status) return false;
        const [l] = await tx.select({ title: listings.title }).from(listings).where(eq(listings.id, b.listingId));
        return fn(tx, b, l?.title ?? "");
      });
      if (moved) done++;
    } catch (err) {
      if (err instanceof AppError && err.code === "conflict") continue;
      console.error(`[worker] booking ${id}:`, err);
      failure ??= err;
    }
  }
  if (failure) throw failure;
  return done;
}

/** `booking_request_expiry`: unanswered requests expire after 72 h, or when the period has started. */
export async function expireBookingRequests(now = new Date()): Promise<number> {
  const ids = await dueBookings(
    sql`${bookings.status} = 'requested' AND (${bookings.ownerResponseDueAt} < ${at(now)} OR lower(${bookings.period}) < ${at(now)})`,
  );
  return eachBooking(ids, "requested", async (tx, b, title) => {
    if (b.ownerResponseDueAt >= now && (await periodStart(tx, b.id)) >= now) return false;
    await moveBooking(tx, b, "expire", "system", null);
    await announce(tx, b, "booking.expired", "booking_expired", ["owner", "renter"], title);
    return true;
  });
}

/** `agreement_expiry`: an accepted booking whose agreement was not accepted by both in time. */
export async function expireAgreements(now = new Date()): Promise<number> {
  const ids = await dueBookings(sql`${bookings.status} = 'accepted' AND ${bookings.agreementDueAt} < ${at(now)}`);
  return eachBooking(ids, "accepted", async (tx, b, title) => {
    if (!b.agreementDueAt || b.agreementDueAt >= now) return false;
    await moveBooking(tx, b, "agreement_timeout", "system", null);
    await closeLiveContract(tx, { bookingId: b.id }, "void");
    await announce(tx, b, "booking.agreement_expired", "booking_expired", ["owner", "renter"], title);
    return true;
  });
}

/**
 * `handover_lapse` (category A only): one party confirmed the handover entry and 24 h have passed since
 * the start. The booking is handed over and the report is `lapsed` («Bekreftet av én part»).
 * A contested report or one nobody confirmed is left alone.
 */
export async function lapseHandovers(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CONDITION_DEADLINES.handoverLapseAfterStartHours * HOUR);
  const ids = await dueBookings(sql`${bookings.status} = 'confirmed' AND ${bookings.valueCategory} = 'A'
    AND lower(${bookings.period}) < ${at(cutoff)}
    AND EXISTS (SELECT 1 FROM condition_reports r JOIN condition_confirmations c ON c.report_id = r.id
      WHERE r.booking_id = ${bookings.id} AND r.phase = 'handover' AND r.status = 'open' AND c.decision = 'confirm')`);
  return eachBooking(ids, "confirmed", async (tx, b, title) => {
    if (b.valueCategory !== "A" || (await periodStart(tx, b.id)) >= cutoff) return false;
    const report = await openReport(tx, b.id, "handover");
    if (!report) return false;
    const d = await decisions(tx, report.id);
    if (d.owner === "contest" || d.renter === "contest") return false;
    const confirmedBy = d.owner === "confirm" ? "owner" : d.renter === "confirm" ? "renter" : null;
    if (!confirmedBy || (d.owner === "confirm" && d.renter === "confirm")) return false;
    await tx
      .update(conditionReports)
      .set({ status: "lapsed", closedAt: now })
      .where(eq(conditionReports.id, report.id));
    await moveBooking(tx, b, "handover_lapsed", "system", null, { handedOverAt: now }, { confirmedBy });
    await announce(tx, b, "booking.handover_lapsed", "handed_over", ["owner", "renter"], title);
    return true;
  });
}

/**
 * `return_lapse`: the other party has not answered the newest return entry within 72 h. The booking is
 * completed with the outcome proposed in that entry and the report is `lapsed`.
 */
export async function lapseReturns(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CONDITION_DEADLINES.returnConfirmWithinHours * HOUR);
  const ids = await dueBookings(sql`${bookings.status} = 'return_pending'
    AND EXISTS (SELECT 1 FROM condition_reports r WHERE r.booking_id = ${bookings.id} AND r.phase = 'return'
      AND r.status = 'open' AND r.closed_at IS NULL
      AND (SELECT max(e.created_at) FROM condition_entries e WHERE e.report_id = r.id) < ${at(cutoff)})`);
  return eachBooking(ids, "return_pending", async (tx, b, title) => {
    const report = await openReport(tx, b.id, "return");
    if (!report) return false;
    const [{ last }] = (
      await tx.execute<{ last: Date | null }>(
        sql`SELECT max(created_at) AS last FROM condition_entries WHERE report_id = ${report.id}`,
      )
    ).rows as [{ last: Date | null }];
    if (!last || new Date(last) >= cutoff) return false;
    const d = await decisions(tx, report.id);
    if (d.owner === "contest" || d.renter === "contest") return false;
    const outcome = await proposedOutcome(tx, report.id);
    await tx
      .update(conditionReports)
      .set({ status: "lapsed", returnOutcome: outcome, closedAt: now })
      .where(eq(conditionReports.id, report.id));
    await moveBooking(tx, b, "return_lapsed", "system", null, { completedAt: now }, { outcome });
    await announce(tx, b, "booking.return_lapsed", "booking_completed", ["owner", "renter"], title);
    return true;
  });
}

/**
 * `return_reminder`: reminds the renter when the period ends, and again 24 h later, when the owner is
 * also told that «Ikke tilbakelevert» is now possible. `reminders_sent` makes each one go out once.
 */
export async function sendReturnReminders(now = new Date()): Promise<number> {
  const late = new Date(now.getTime() - CONDITION_DEADLINES.notReturnedAfterHours * HOUR);
  let sent = 0;
  // The later reminder first, so a worker that was down does not send both at once.
  for (const step of [
    { key: "not_returned_possible", endedBefore: late, also: ["end"] },
    { key: "end", endedBefore: now, also: [] as string[] },
  ]) {
    const ids = await dueBookings(sql`${bookings.status} = 'handed_over'
      AND upper(${bookings.period}) <= ${at(step.endedBefore)}
      AND NOT (${bookings.remindersSent} @> ${JSON.stringify([step.key])}::jsonb)`);
    sent += await eachBooking(ids, "handed_over", async (tx, b, title) => {
      if (b.remindersSent.includes(step.key)) return false;
      const keys = [...new Set([...b.remindersSent, step.key, ...step.also])];
      await tx.update(bookings).set({ remindersSent: keys }).where(eq(bookings.id, b.id));
      const path = `/leieforhold/${b.id}`;
      await notify(tx, { userId: b.renterId, kind: "return_reminder", title, path, email: "essential" });
      if (step.key === "not_returned_possible") {
        await notify(tx, { userId: b.ownerId, kind: "not_returned_possible", title, path, email: "essential" });
      }
      return true;
    });
  }
  return sent;
}

async function periodStart(tx: Tx, bookingId: string): Promise<Date> {
  const [{ s }] = (await tx.execute<{ s: Date }>(sql`SELECT lower(period) AS s FROM bookings WHERE id = ${bookingId}`))
    .rows as [{ s: Date }];
  return new Date(s);
}

async function openReport(tx: Tx, bookingId: string, phase: "handover" | "return") {
  const [r] = await tx
    .select()
    .from(conditionReports)
    .where(and(eq(conditionReports.bookingId, bookingId), eq(conditionReports.phase, phase)))
    .for("update");
  return r && r.status === "open" && !r.closedAt ? r : null;
}
