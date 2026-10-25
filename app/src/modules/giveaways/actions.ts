"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/i18n/page";
import { requireUser } from "@/modules/auth/actor";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import {
  cancelSelectedClaim,
  claimSchema,
  confirmTransfer,
  createClaim,
  declineClaim,
  selectClaim,
  withdrawClaim,
} from "./service";

const localeOf = (raw: Record<string, string>) => (raw.locale === "en" ? "en" : "nb");

function done(locale: "nb" | "en", path: string, ok: string): never {
  revalidatePath("/[locale]", "layout");
  redirect(`${localePath(locale, path)}?ok=${ok}`);
}

/** «Jeg vil gjerne ha den» on the listing page. */
export async function createClaimAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => createClaim(await requireUser(), claimSchema.parse(raw)), raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), `/overlevering/${result.data.id}`, "claimed");
}

const opSchema = z.object({
  claimId: z.uuid(),
  op: z.enum(["select", "decline", "withdraw", "cancel"]),
  back: z.enum(["listing", "claim"]).default("claim"),
  listingId: z.uuid().optional(),
});

/** Giver: «Velg» / «Avslå». Claimant: «Trekk tilbake». Either, once selected: «Avlys». */
export async function claimStepAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const actor = await requireUser();
    const input = opSchema.parse(raw);
    if (input.op === "select") await selectClaim(actor, input.claimId);
    if (input.op === "decline") await declineClaim(actor, input.claimId);
    if (input.op === "withdraw") await withdrawClaim(actor, input.claimId);
    if (input.op === "cancel") await cancelSelectedClaim(actor, input.claimId);
    return input;
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  const { op, claimId, back, listingId } = result.data;
  done(
    localeOf(raw),
    back === "listing" && listingId && op !== "select" ? `/annonse/${listingId}` : `/overlevering/${claimId}`,
    op,
  );
}

const confirmSchema = z.object({ claimId: z.uuid(), sha256: z.string().regex(/^[0-9a-f]{64}$/) });

/** Each party confirms the exact transfer text after the handover. */
export async function confirmTransferAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const { claimId, sha256 } = confirmSchema.parse(raw);
    if (raw.handedOver !== "on")
      throw new z.ZodError([{ code: "custom", path: ["handedOver"], message: "must_confirm_handover", input: "" }]);
    return { claimId, outcome: await confirmTransfer(await requireUser(), claimId, sha256) };
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  done(localeOf(raw), `/overlevering/${result.data.claimId}`, result.data.outcome);
}
