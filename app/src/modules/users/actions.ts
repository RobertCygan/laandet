"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/actor";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import { AppError } from "@/modules/errors";
import { profileSchema, removeAvatar, setAvatar, updateProfile } from "./service";

export async function updateProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const actor = await requireUser();
    await updateProfile(actor, profileSchema.parse(raw));
  }, raw);
  if (result.status === "ok") revalidatePath("/[locale]", "layout");
  return result;
}

/** Upload or replace the profile photo (D-061). */
export async function setAvatarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const actor = await requireUser();
    const file = form.get("avatar");
    if (!(file instanceof File) || file.size === 0) throw new AppError("validation", "image_missing");
    await setAvatar(actor, file);
  });
  if (result.status === "ok") revalidatePath("/[locale]", "layout");
  return result;
}

export async function removeAvatarAction(): Promise<ActionState> {
  const result = await runAction(async () => {
    await removeAvatar(await requireUser());
  });
  if (result.status === "ok") revalidatePath("/[locale]", "layout");
  return result;
}
