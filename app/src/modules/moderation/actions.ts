"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { osloLocalToDate } from "@/i18n/format";
import { getActor } from "@/modules/auth/actor";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import {
  appealSchema,
  createAppeal,
  createReport,
  decideAppeal,
  decideAppealSchema,
  dismissReport,
  hideListing,
  hideSchema,
  reportSchema,
} from "./service";
import { applyUserMeasure, userMeasureSchema } from "./users";

export async function reportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  return runAction(async () => createReport(await getActor(), reportSchema.parse(raw)), raw);
}

export async function appealAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => createAppeal(await getActor(), appealSchema.parse(raw)), raw);
  if (result.status === "ok") revalidatePath("/[locale]", "layout");
  return result;
}

/** Staff actions return to the queue they came from with a confirmation (`?lagret=1`). */
function backToQueue(raw: Record<string, string>): never {
  revalidatePath("/[locale]", "layout");
  const back = /^(\/en)?\/admin(\/rapporter|\/klager)?$/.test(raw.back ?? "") ? raw.back : "/admin";
  redirect(`${back}?lagret=1`);
}

export async function hideListingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => hideListing(await getActor(), hideSchema.parse(raw)), raw);
  if (result.status === "ok") backToQueue(raw);
  return result;
}

const dismissSchema = z.object({
  reportId: z.uuid(),
  note: z.string().trim().max(2000, { error: "too_long" }).default(""),
});

export async function dismissReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const { reportId, note } = dismissSchema.parse(raw);
    await dismissReport(await getActor(), reportId, note);
  }, raw);
  if (result.status === "ok") backToQueue(raw);
  return result;
}

/** Warn, restrict (optionally until a date), suspend or reinstate an account (P03-03). */
export async function userMeasureAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    let until: string | undefined;
    if (raw.measure === "restrict" && raw.untilDate) {
      const at = osloLocalToDate(raw.untilDate, "23:59");
      if (!at) throw new z.ZodError([{ code: "custom", path: ["until"], message: "date_invalid", input: "" }]);
      until = at.toISOString();
    }
    await applyUserMeasure(await getActor(), userMeasureSchema.parse({ ...raw, until }));
  }, raw);
  if (result.status === "ok") backToQueue(raw);
  return result;
}

export async function decideAppealAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => decideAppeal(await getActor(), decideAppealSchema.parse(raw)), raw);
  if (result.status === "ok") backToQueue(raw);
  return result;
}
