"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { osloLocalToDate, parseKrToOre } from "@/i18n/format";
import { localePath } from "@/i18n/page";
import { requireUser } from "@/modules/auth/actor";
import { uploadImage, type UploadedMedia } from "@/modules/media/service";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import {
  addMessageReference,
  addStatement,
  answerRecommendation,
  escalate,
  makeProposal,
  openDispute,
  openSchema,
  proposalSchema,
  recommendationAnswerSchema,
  referenceSchema,
  respondSchema,
  respondToProposal,
  statementSchema,
  withdrawDispute,
} from "./service";
import {
  addSupportNote,
  closeByStaff,
  closeSchema,
  documentationSchema,
  noteSchema,
  recommend,
  recommendSchema,
  reopenCase,
  reopenSchema,
  requestDocumentation,
  takeCase,
  takeSchema,
} from "./support";

const localeOf = (raw: Record<string, string>) => (raw.locale === "en" ? "en" : "nb");
const uuid = z.uuid();

function done(locale: "nb" | "en", path: string, ok: string): never {
  revalidatePath("/[locale]", "layout");
  redirect(`${localePath(locale, path)}?ok=${ok}`);
}

function fieldError(field: string, message: string): never {
  throw new z.ZodError([{ code: "custom", path: [field], message, input: "" }]);
}

/** «Meld fra om et problem». */
export async function openDisputeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = openSchema.parse({ ...raw, photoIds: form.getAll("photoId").map(String) });
    return openDispute(await requireUser(), input);
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), `/saker/${result.data.id}`, "opened");
}

/** One case photo per call (re-encoded, metadata stripped), attached when the statement is saved. */
export async function uploadDisputePhotoAction(form: FormData): Promise<ActionState<UploadedMedia>> {
  return runAction(async () => {
    const actor = await requireUser();
    const file = form.get("file");
    if (!(file instanceof File)) fieldError("file", "image_missing");
    return uploadImage(actor, file, "dispute");
  });
}

export async function statementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = statementSchema.parse({ ...raw, photoIds: form.getAll("photoId").map(String) });
    await addStatement(await requireUser(), input);
    return input.disputeId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), `/saker/${result.data}`, "statement");
}

export async function referenceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = referenceSchema.parse(raw);
    await addMessageReference(await requireUser(), input);
    return input.disputeId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), `/saker/${result.data}`, "reference");
}

export async function proposalAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    let amountOre: number | undefined;
    if (raw.type === "partial_compensation" || raw.type === "full_compensation") {
      const parsed = parseKrToOre(raw.amount ?? "");
      if (parsed === null) fieldError("amount", "amount_invalid");
      amountOre = parsed;
    }
    let newReturnAt: string | undefined;
    if (raw.type === "extra_return_time") {
      const at = osloLocalToDate(raw.returnDate ?? "", raw.returnTime ?? "");
      if (!at) fieldError("newReturnAt", "date_invalid");
      newReturnAt = at.toISOString();
    }
    const input = proposalSchema.parse({ ...raw, amountOre, newReturnAt });
    await makeProposal(await requireUser(), input);
    return input.disputeId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), `/saker/${result.data}`, "proposal");
}

export async function respondProposalAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    await respondToProposal(await requireUser(), respondSchema.parse(raw));
    return uuid.parse(raw.disputeId);
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), `/saker/${result.data}`, raw.decision === "accept" ? "accepted" : "rejected");
}

export async function recommendationAnswerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = recommendationAnswerSchema.parse(raw);
    await answerRecommendation(await requireUser(), input);
    return input.disputeId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), `/saker/${result.data}`, "answered");
}

const caseOp = z.object({ disputeId: z.uuid(), op: z.enum(["escalate", "withdraw"]) });

/** «Be Laandet om hjelp» and «Trekk tilbake saken». */
export async function caseStepAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const { disputeId, op } = caseOp.parse(raw);
    const actor = await requireUser();
    if (op === "escalate") await escalate(actor, disputeId);
    else await withdrawDispute(actor, disputeId);
    return { disputeId, op };
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), `/saker/${result.data.disputeId}`, result.data.op);
}

// ---------------------------------------------------------------- staff

const staffPath = (id: string) => `/admin/saker/${id}`;

export async function takeCaseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = takeSchema.parse(raw);
    await takeCase(await requireUser(), input);
    return input.disputeId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), staffPath(result.data), "taken");
}

export async function supportNoteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = noteSchema.parse(raw);
    await addSupportNote(await requireUser(), input);
    return input.disputeId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), staffPath(result.data), "note");
}

export async function documentationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = documentationSchema.parse(raw);
    await requestDocumentation(await requireUser(), input);
    return input.disputeId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), staffPath(result.data), "documentation");
}

export async function recommendAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = recommendSchema.parse(raw);
    await recommend(await requireUser(), input);
    return input.disputeId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), staffPath(result.data), "recommended");
}

export async function staffCloseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = closeSchema.parse(raw);
    await closeByStaff(await requireUser(), input);
    return input.disputeId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), staffPath(result.data), "closed");
}

export async function reopenAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = reopenSchema.parse(raw);
    await reopenCase(await requireUser(), input);
    return input.disputeId;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), staffPath(result.data), "reopened");
}
