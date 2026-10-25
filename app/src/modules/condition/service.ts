import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/db/client";
import {
  bookings,
  conditionConfirmations,
  conditionEntries,
  conditionPhotos,
  conditionReports,
  CLEANLINESS,
  disputes,
  FUNCTIONAL_STATUSES,
  ITEM_CONDITION_VALUES,
  listings,
  mediaObjects,
  RETURN_OUTCOMES,
  type ReportPhase,
  type ReturnOutcome,
} from "@/db/schema";
import type { Actor, UserActor } from "@/modules/authz/actor-types";
import { AppError } from "@/modules/errors";
import { announce, loadBookingFor, moveBooking, periodOf } from "@/modules/rentals/service";

const HOUR = 60 * 60 * 1000;
/** CONDITION_REPORTS §7 (configurable deadlines). */
export const CONDITION_DEADLINES = {
  handoverPrepareFromHours: 48,
  handoverLapseAfterStartHours: 24,
  returnConfirmWithinHours: 72,
  notReturnedAfterHours: 24,
  disputeResponseDays: 7,
};

/** Handover checklist (CONDITION_REPORTS §4): all five must be ticked to confirm. */
export const HANDOVER_CHECKLIST = [
  "correct_item",
  "condition_described",
  "accessories_included",
  "instructions_given",
  "handover_as_agreed",
] as const;
const PROMPT_OUTCOMES = ["returned_ok", "returned_normal_wear", "returned_with_deviation"] as const;

type Role = "owner" | "renter";
const roleIn = (b: { ownerId: string; renterId: string }, userId: string): Role =>
  b.ownerId === userId ? "owner" : "renter";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "too_long" })
    .optional()
    .transform((v) => (v ? v : null));

export const entrySchema = z.object({
  bookingId: z.uuid(),
  phase: z.enum(["handover", "return"]),
  supersedesEntryId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  overallCondition: z.enum(ITEM_CONDITION_VALUES, { error: "required" }),
  functionalStatus: z.enum(FUNCTIONAL_STATUSES, { error: "required" }),
  existingDamage: optText(2000),
  newDamage: optText(2000),
  fuelOrBattery: optText(100),
  cleanliness: z
    .enum(CLEANLINESS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  serialOrIdentifier: optText(100),
  notes: optText(2000),
  proposedOutcome: z
    .enum(PROMPT_OUTCOMES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  accessories: z
    .array(z.object({ name: z.string().max(80), present: z.boolean() }))
    .max(20)
    .default([]),
  photoIds: z.array(z.uuid()).max(8).default([]),
});

async function reportFor(tx: Tx, bookingId: string, phase: ReportPhase) {
  await tx.insert(conditionReports).values({ bookingId, phase }).onConflictDoNothing();
  const [r] = await tx
    .select()
    .from(conditionReports)
    .where(and(eq(conditionReports.bookingId, bookingId), eq(conditionReports.phase, phase)))
    .for("update");
  return r!;
}

async function latestSeq(tx: typeof db | Tx, reportId: string): Promise<number> {
  const [r] = await tx
    .select({ m: sql<number>`coalesce(max(${conditionEntries.seq}), 0)::int` })
    .from(conditionEntries)
    .where(eq(conditionEntries.reportId, reportId));
  return r?.m ?? 0;
}

/** Each party's latest decision on the current version of the report (a newer entry resets it). */
export async function decisions(
  tx: typeof db | Tx,
  reportId: string,
): Promise<{ seq: number; owner: "confirm" | "contest" | null; renter: "confirm" | "contest" | null }> {
  const seq = await latestSeq(tx, reportId);
  const rows = await tx
    .select({ role: conditionConfirmations.partyRole, decision: conditionConfirmations.decision })
    .from(conditionConfirmations)
    .where(and(eq(conditionConfirmations.reportId, reportId), eq(conditionConfirmations.latestEntrySeq, seq)))
    .orderBy(desc(conditionConfirmations.createdAt));
  const pick = (r: Role) => rows.find((x) => x.role === r)?.decision ?? null;
  return { seq, owner: pick("owner"), renter: pick("renter") };
}

/**
 * Adds one party's own entry (CONDITION_REPORTS §2–§5). Entries are never changed; a correction
 * supersedes the author's own earlier entry. A first return entry moves the booking to return_pending.
 */
export async function addEntry(
  actor: Actor,
  input: z.infer<typeof entrySchema>,
  now = new Date(),
): Promise<{ seq: number }> {
  const b = await loadBookingFor(actor, input.bookingId, "booking.participate");
  const me = (actor as UserActor).id;
  const role = roleIn(b, me);
  const { start } = await periodOf(db, b.id);
  if (input.phase === "handover") {
    if (b.status !== "confirmed") throw new AppError("conflict", "handover_not_open");
    if (now.getTime() < start.getTime() - CONDITION_DEADLINES.handoverPrepareFromHours * HOUR)
      throw new AppError("conflict", "handover_too_early");
  } else if (!["handed_over", "not_returned", "return_pending"].includes(b.status)) {
    throw new AppError("conflict", "return_not_open");
  }
  if (input.phase === "return" && !input.proposedOutcome) {
    throw new AppError("validation", "entry_invalid", { fieldErrors: { proposedOutcome: "required" } });
  }
  const [l] = await db.select({ title: listings.title }).from(listings).where(eq(listings.id, b.listingId));

  return db.transaction(async (tx) => {
    const report = await reportFor(tx, b.id, input.phase);
    if (report.status === "agreed" || report.status === "lapsed" || report.closedAt)
      throw new AppError("conflict", "report_closed");
    if (input.supersedesEntryId) {
      const [prev] = await tx.select().from(conditionEntries).where(eq(conditionEntries.id, input.supersedesEntryId));
      if (!prev || prev.reportId !== report.id || prev.authorId !== me) throw new AppError("not_found");
    }
    if (input.photoIds.length) {
      const own = await tx
        .select({ id: mediaObjects.id })
        .from(mediaObjects)
        .leftJoin(conditionPhotos, eq(conditionPhotos.mediaId, mediaObjects.id))
        .where(
          and(
            inArray(mediaObjects.id, input.photoIds),
            eq(mediaObjects.uploadedBy, me),
            eq(mediaObjects.scope, "condition"),
            isNull(mediaObjects.deletedAt),
            isNull(conditionPhotos.id),
          ),
        );
      if (own.length !== new Set(input.photoIds).size) throw new AppError("not_found", "media");
    }
    const seq = (await latestSeq(tx, report.id)) + 1;
    const [entry] = await tx
      .insert(conditionEntries)
      .values({
        reportId: report.id,
        authorId: me,
        authorRole: role,
        seq,
        supersedesEntryId: input.supersedesEntryId ?? null,
        overallCondition: input.overallCondition,
        functionalStatus: input.functionalStatus,
        existingDamage: input.phase === "handover" ? input.existingDamage : null,
        newDamage: input.phase === "return" ? input.newDamage : null,
        accessories: input.accessories,
        fuelOrBattery: input.fuelOrBattery,
        cleanliness: input.cleanliness ?? null,
        serialOrIdentifier: input.serialOrIdentifier,
        proposedOutcome: input.phase === "return" ? (input.proposedOutcome ?? null) : null,
        notes: input.notes,
      })
      .returning({ id: conditionEntries.id });
    for (const mediaId of input.photoIds) await tx.insert(conditionPhotos).values({ entryId: entry!.id, mediaId });
    if (report.status === "contested" && input.phase === "handover") {
      await tx.update(conditionReports).set({ status: "open" }).where(eq(conditionReports.id, report.id));
    }
    if (input.phase === "return" && (b.status === "handed_over" || b.status === "not_returned")) {
      await moveBooking(tx, b, "return_recorded", role, me, { returnedAt: now });
      await tx
        .update(conditionReports)
        .set({ actualReturnedAt: now, returnOutcome: null })
        .where(eq(conditionReports.id, report.id));
      await announce(
        tx,
        b,
        "booking.return_recorded",
        "condition_to_confirm",
        [role === "owner" ? "renter" : "owner"],
        l?.title ?? "",
      );
    } else {
      await announce(
        tx,
        b,
        input.phase === "handover" ? "booking.handover_entry" : "booking.return_entry",
        "condition_to_confirm",
        [role === "owner" ? "renter" : "owner"],
        l?.title ?? "",
      );
    }
    return { seq };
  });
}

export const confirmSchema = z.object({
  bookingId: z.uuid(),
  phase: z.enum(["handover", "return"]),
  decision: z.enum(["confirm", "contest"]),
  checklist: z.record(z.string(), z.boolean()).default({}),
  comment: z.string().trim().max(2000, { error: "too_long" }).optional().default(""),
});

/** Confirms or contests the current version of a report; both confirmations close it. */
export async function confirmReport(
  actor: Actor,
  input: z.infer<typeof confirmSchema>,
  now = new Date(),
): Promise<"waiting" | "agreed" | "contested"> {
  const b = await loadBookingFor(actor, input.bookingId, "booking.participate");
  const me = (actor as UserActor).id;
  const role = roleIn(b, me);
  if (input.phase === "handover" && b.status !== "confirmed") throw new AppError("conflict", "handover_not_open");
  if (input.phase === "return" && b.status !== "return_pending") throw new AppError("conflict", "return_not_open");
  if (
    input.decision === "confirm" &&
    input.phase === "handover" &&
    !HANDOVER_CHECKLIST.every((k) => input.checklist[k])
  ) {
    throw new AppError("validation", "checklist_incomplete", { fieldErrors: { checklist: "checklist_incomplete" } });
  }
  if (input.decision === "contest" && input.comment.length < 3) {
    throw new AppError("validation", "entry_invalid", { fieldErrors: { comment: "reason_required" } });
  }
  const [l] = await db.select({ title: listings.title }).from(listings).where(eq(listings.id, b.listingId));
  const title = l?.title ?? "";
  const other: Role = role === "owner" ? "renter" : "owner";

  return db.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(conditionReports)
      .where(and(eq(conditionReports.bookingId, b.id), eq(conditionReports.phase, input.phase)))
      .for("update");
    if (!report || report.closedAt) throw new AppError("conflict", "report_closed");
    const seq = await latestSeq(tx, report.id);
    if (seq === 0) throw new AppError("conflict", "report_empty");
    await tx.insert(conditionConfirmations).values({
      reportId: report.id,
      userId: me,
      partyRole: role,
      decision: input.decision,
      checklist: input.checklist,
      comment: input.comment || null,
      latestEntrySeq: seq,
    });

    if (input.decision === "contest") {
      if (input.phase === "handover") {
        // The booking stays confirmed; the owner may correct the entry or either may cancel.
        await tx.update(conditionReports).set({ status: "contested" }).where(eq(conditionReports.id, report.id));
        await announce(tx, b, "booking.handover_contested", "condition_to_confirm", [other], title);
        return "contested";
      }
      await tx
        .update(conditionReports)
        .set({ status: "contested", returnOutcome: "return_disputed", closedAt: now })
        .where(eq(conditionReports.id, report.id));
      await moveBooking(tx, b, "return_contested", role, me);
      await tx.insert(disputes).values({
        bookingId: b.id,
        openedBy: me,
        respondentId: role === "owner" ? b.renterId : b.ownerId,
        category: "other",
        summary:
          input.comment.length >= 10 ? input.comment : `Tilbakelevering bestridt: ${input.comment}`.slice(0, 4000),
        responseDueAt: new Date(now.getTime() + CONDITION_DEADLINES.disputeResponseDays * 24 * HOUR),
      });
      await announce(tx, b, "booking.disputed", "booking_disputed", [other], title);
      return "contested";
    }

    const d = await decisions(tx, report.id);
    if (d.owner !== "confirm" || d.renter !== "confirm") {
      await notifyOther(tx, b, other, title);
      return "waiting";
    }
    if (input.phase === "handover") {
      await tx
        .update(conditionReports)
        .set({ status: "agreed", closedAt: now })
        .where(eq(conditionReports.id, report.id));
      await moveBooking(tx, b, "handover_confirmed", role, me, { handedOverAt: now });
      await announce(tx, b, "booking.handed_over", "handed_over", ["owner", "renter"], title);
      return "agreed";
    }
    const outcome = await proposedOutcome(tx, report.id);
    await tx
      .update(conditionReports)
      .set({ status: "agreed", returnOutcome: outcome, closedAt: now })
      .where(eq(conditionReports.id, report.id));
    await moveBooking(tx, b, "return_agreed", role, me, { completedAt: now }, { outcome });
    await announce(tx, b, "booking.completed", "booking_completed", ["owner", "renter"], title);
    return "agreed";
  });
}

async function notifyOther(tx: Tx, b: typeof bookings.$inferSelect, other: Role, title: string) {
  const { notify } = await import("@/modules/notifications/notify");
  await notify(tx, {
    userId: other === "owner" ? b.ownerId : b.renterId,
    kind: "condition_to_confirm",
    title,
    path: `/leieforhold/${b.id}`,
    email: "essential",
  });
}

/** The outcome proposed in the newest return entry that has one (CONDITION_REPORTS §5.3). */
export async function proposedOutcome(tx: typeof db | Tx, reportId: string): Promise<ReturnOutcome> {
  const [e] = await tx
    .select({ o: conditionEntries.proposedOutcome })
    .from(conditionEntries)
    .where(and(eq(conditionEntries.reportId, reportId), sql`${conditionEntries.proposedOutcome} IS NOT NULL`))
    .orderBy(desc(conditionEntries.seq))
    .limit(1);
  const o = e?.o ?? "returned_ok";
  return (RETURN_OUTCOMES as readonly string[]).includes(o) ? (o as ReturnOutcome) : "returned_ok";
}

/** «Ikke tilbakelevert»: owner only, from 24 h after the end of the period (CONDITION_REPORTS §7). */
export async function markNotReturned(actor: Actor, bookingId: string, now = new Date()): Promise<void> {
  const b = await loadBookingFor(actor, bookingId, "booking.respond");
  const { end } = await periodOf(db, b.id);
  if (now.getTime() < end.getTime() + CONDITION_DEADLINES.notReturnedAfterHours * HOUR)
    throw new AppError("conflict", "not_returned_too_early");
  const [l] = await db.select({ title: listings.title }).from(listings).where(eq(listings.id, b.listingId));
  await db.transaction(async (tx) => {
    await moveBooking(tx, b, "mark_not_returned", "owner", (actor as UserActor).id);
    const report = await reportFor(tx, b.id, "return");
    await tx.update(conditionReports).set({ returnOutcome: "not_returned" }).where(eq(conditionReports.id, report.id));
    await announce(tx, b, "booking.not_returned", "booking_disputed", ["renter"], l?.title ?? "");
  });
}
