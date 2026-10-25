"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/actor";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import { profileSchema, updateProfile } from "./service";

export async function updateProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const actor = await requireUser();
    await updateProfile(actor, profileSchema.parse(raw));
  }, raw);
  if (result.status === "ok") revalidatePath("/[locale]", "layout");
  return result;
}
