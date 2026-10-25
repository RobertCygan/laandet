"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localePath } from "@/i18n/page";
import { requireUser } from "@/modules/auth/actor";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import { acceptPending, acceptSchema } from "./acceptance";

export async function acceptTermsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const actor = await requireUser();
    acceptSchema.parse(raw);
    await acceptPending(actor);
  });
  if (result.status !== "ok") return result;
  revalidatePath("/[locale]", "layout");
  const next = raw.next && raw.next.startsWith("/") && !raw.next.startsWith("//") ? raw.next : localePath(raw.locale ?? "nb", "/konto");
  redirect(next);
}
