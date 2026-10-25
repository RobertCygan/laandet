"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

export async function hideListingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => hideListing(await getActor(), hideSchema.parse(raw)), raw);
  if (result.status === "ok") revalidatePath("/[locale]", "layout");
  return result;
}

const dismissSchema = z.object({ reportId: z.uuid(), note: z.string().trim().max(2000, { error: "too_long" }).default("") });

export async function dismissReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const { reportId, note } = dismissSchema.parse(raw);
    await dismissReport(await getActor(), reportId, note);
  }, raw);
  if (result.status === "ok") revalidatePath("/[locale]", "layout");
  return result;
}

export async function decideAppealAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => decideAppeal(await getActor(), decideAppealSchema.parse(raw)), raw);
  if (result.status === "ok") revalidatePath("/[locale]", "layout");
  return result;
}
