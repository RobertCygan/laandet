import { and, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { entrySchema } from "@/modules/condition/service";
import { saveListing } from "@/modules/listings/service";
import { acceptAgreement, acceptBooking, requestBooking } from "@/modules/rentals/service";
import { createUser, owner, rentalDraft } from "./helpers";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** A whole hour `n` days from now (UTC). */
export const inDays = (n: number, hour = 10) => {
  const d = new Date(Date.now() + n * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

export async function setRentalsOpen(on: boolean) {
  await owner
    .insert(schema.featureFlags)
    .values({ key: "rentals_open", enabled: on, description: "test" })
    .onConflictDoUpdate({ target: schema.featureFlags.key, set: { enabled: on } });
}

/** Request → accept → both accept the agreement. Rentals must be open. */
export async function confirmedBooking(fromDay = 3, toDay = 5) {
  const lender = await createUser({ name: "Utleier U." });
  const renter = await createUser({ name: "Leietaker L." });
  const { id: listingId } = await saveListing(lender, await rentalDraft(), [], { intent: "publish" });
  const start = inDays(fromDay);
  const end = inDays(toDay);
  const { id } = await requestBooking(renter, {
    listingId,
    start: start.toISOString(),
    end: end.toISOString(),
    handoverMethod: "pickup",
    returnMethod: "pickup",
    message: "",
  });
  await acceptBooking(lender, id);
  const [c] = await owner.select().from(schema.contracts).where(eq(schema.contracts.bookingId, id));
  await acceptAgreement(renter, id, c!.renderedSha256);
  await acceptAgreement(lender, id, c!.renderedSha256);
  return { lender, renter, listingId, id, start, end };
}

export const entry = (bookingId: string, phase: "handover" | "return", extra: Record<string, unknown> = {}) =>
  entrySchema.parse({ bookingId, phase, overallCondition: "good", functionalStatus: "works", ...extra });

export const ALL_CHECKED = {
  correct_item: true,
  condition_described: true,
  accessories_included: true,
  instructions_given: true,
  handover_as_agreed: true,
};

export async function bookingRow(id: string) {
  const [b] = await owner.select().from(schema.bookings).where(eq(schema.bookings.id, id));
  return b!;
}

export async function reportRow(bookingId: string, phase: "handover" | "return") {
  const [r] = await owner
    .select()
    .from(schema.conditionReports)
    .where(and(eq(schema.conditionReports.bookingId, bookingId), eq(schema.conditionReports.phase, phase)));
  return r;
}

export async function noticesFor(userId: string) {
  const rows = await owner
    .select({ type: schema.notifications.type })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId));
  return rows.map((r) => r.type);
}
