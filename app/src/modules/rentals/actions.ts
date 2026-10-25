"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { osloLocalToDate } from "@/i18n/format";
import { localePath } from "@/i18n/page";
import { requireUser } from "@/modules/auth/actor";
import { addEntry, confirmReport, confirmSchema, entrySchema, markNotReturned } from "@/modules/condition/service";
import { uploadImage, type UploadedMedia } from "@/modules/media/service";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import {
  acceptAgreement,
  acceptBooking,
  cancelBooking,
  cancelSchema,
  changeTerms,
  changeTermsSchema,
  declineBooking,
  meetingPlaceSchema,
  requestBooking,
  requestSchema,
  setMeetingPlace,
  withdrawBooking,
} from "./service";

const localeOf = (raw: Record<string, string>) => (raw.locale === "en" ? "en" : "nb");
const bookingPath = (id: string, sub = "") => `/leieforhold/${id}${sub}`;

function done(locale: "nb" | "en", path: string, ok: string): never {
  revalidatePath("/[locale]", "layout");
  redirect(`${localePath(locale, path)}?ok=${ok}`);
}

/** Date + time fields (Europe/Oslo) → ISO strings for the service schemas. */
function period(raw: Record<string, string>) {
  const start = osloLocalToDate(raw.startDate ?? "", raw.startTime ?? "");
  const end = osloLocalToDate(raw.endDate ?? "", raw.endTime ?? "");
  const errors: Record<string, string> = {};
  if (!start) errors.start = "date_invalid";
  if (!end) errors.end = "date_invalid";
  if (Object.keys(errors).length)
    throw new z.ZodError(
      Object.entries(errors).map(([k, message]) => ({ code: "custom" as const, path: [k], message, input: "" })),
    );
  return { start: start!.toISOString(), end: end!.toISOString() };
}

/** «Send forespørsel» on the listing page. */
export async function requestBookingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const actor = await requireUser();
    return requestBooking(actor, requestSchema.parse({ ...raw, ...period(raw) }));
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), bookingPath(result.data.id), "requested");
}

const opSchema = z.object({
  bookingId: z.uuid(),
  op: z.enum(["accept", "decline", "withdraw", "not_returned"]),
});

/** One-click steps on the booking page. */
export async function bookingStepAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const actor = await requireUser();
    const { bookingId, op } = opSchema.parse(raw);
    if (op === "accept") await acceptBooking(actor, bookingId);
    if (op === "decline") await declineBooking(actor, bookingId);
    if (op === "withdraw") await withdrawBooking(actor, bookingId);
    if (op === "not_returned") await markNotReturned(actor, bookingId);
    return { bookingId, op };
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), bookingPath(result.data.bookingId), result.data.op);
}

export async function cancelBookingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = cancelSchema.parse(raw);
    await cancelBooking(await requireUser(), input);
    return input.bookingId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), bookingPath(result.data), "cancelled");
}

export async function meetingPlaceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = meetingPlaceSchema.parse(raw);
    await setMeetingPlace(await requireUser(), input);
    return input.bookingId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), bookingPath(result.data), "place");
}

export async function changeTermsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = changeTermsSchema.parse({ ...raw, ...period(raw) });
    await changeTerms(await requireUser(), input);
    return input.bookingId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), bookingPath(result.data, "/avtale"), "revised");
}

const acceptSchema = z.object({ bookingId: z.uuid(), sha256: z.string().regex(/^[0-9a-f]{64}$/) });

/** «Jeg godtar avtalen»: posts the hash of the exact text that was shown. */
export async function acceptAgreementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const { bookingId, sha256 } = acceptSchema.parse(raw);
    if (raw.read !== "on")
      throw new z.ZodError([{ code: "custom", path: ["read"], message: "must_confirm_read", input: "" }]);
    const outcome = await acceptAgreement(await requireUser(), bookingId, sha256);
    return { bookingId, outcome };
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), bookingPath(result.data.bookingId, "/avtale"), result.data.outcome);
}

const phasePath = (phase: string) => (phase === "return" ? "/tilbakelevering" : "/utlevering");

/** A party's own condition entry, with the photos uploaded just before. */
export async function conditionEntryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const names = form.getAll("accessoryName").map(String);
    const present = new Set(form.getAll("accessoryPresent").map(String));
    const input = entrySchema.parse({
      ...raw,
      accessories: names.map((name, i) => ({ name, present: present.has(String(i)) })),
      photoIds: form.getAll("photoId").map(String),
    });
    await addEntry(await requireUser(), input);
    return input;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), bookingPath(result.data.bookingId, phasePath(result.data.phase)), "entry");
}

export async function confirmConditionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const checklist = Object.fromEntries(form.getAll("check").map((k) => [String(k), true]));
    const input = confirmSchema.parse({ ...raw, checklist });
    const outcome = await confirmReport(await requireUser(), input);
    return { input, outcome };
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  const { input, outcome } = result.data;
  done(localeOf(raw), bookingPath(input.bookingId, phasePath(input.phase)), outcome);
}

/** One condition photo per call (re-encoded, metadata stripped), attached when the entry is saved. */
export async function uploadConditionPhotoAction(form: FormData): Promise<ActionState<UploadedMedia>> {
  return runAction(async () => {
    const actor = await requireUser();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new z.ZodError([{ code: "custom", path: ["file"], message: "image_missing", input: file }]);
    return uploadImage(actor, file, "condition");
  });
}
