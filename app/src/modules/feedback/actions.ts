"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/i18n/page";
import { getActor } from "@/modules/auth/actor";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import { feedbackSchema, markFeedbackHandled, sendFeedback } from "./service";

const loc = (raw: Record<string, string>) => (raw.locale === "en" ? "en" : "nb");

export async function sendFeedbackAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => sendFeedback(await getActor(), feedbackSchema.parse(raw)), raw);
  if (result.status === "ok") redirect(`${localePath(loc(raw), "/tilbakemelding")}?takk=1`);
  return result;
}

export async function markFeedbackHandledAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () =>
    markFeedbackHandled(await getActor(), z.object({ feedbackId: z.uuid() }).parse(raw).feedbackId),
  );
  if (result.status === "ok") {
    revalidatePath("/[locale]/admin/tilbakemeldinger", "page");
    redirect(`${localePath(loc(raw), "/admin/tilbakemeldinger")}?lagret=1`);
  }
  return result;
}
