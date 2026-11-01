"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localePath } from "@/i18n/page";
import { getActor } from "@/modules/auth/actor";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import {
  categoryPolicySchema,
  categorySchema,
  createLocality,
  createLocalitySchema,
  updateCategory,
  updateCategoryPolicy,
  updateLocality,
  updateLocalitySchema,
} from "./catalog";
import { flagSchema, setFlag } from "./settings";
import {
  removeTransparencyMonth,
  removeTransparencySchema,
  saveTransparencyMonth,
  transparencySchema,
} from "./transparency";

/** Back to the admin section with a confirmation; the whole site is revalidated (flags and categories show everywhere). */
function saved(raw: Record<string, string>, path: string): never {
  revalidatePath("/[locale]", "layout");
  redirect(`${localePath(raw.locale === "en" ? "en" : "nb", path)}?lagret=1`);
}

export async function categoryPolicyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(
    async () => updateCategoryPolicy(await getActor(), categoryPolicySchema.parse(raw)),
    raw,
  );
  if (result.status === "ok") saved(raw, "/admin/kategorier");
  return result;
}

export async function categoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = categorySchema.parse({ ...raw, types: form.getAll("types").map(String) });
    await updateCategory(await getActor(), input);
  }, raw);
  if (result.status === "ok") saved(raw, "/admin/kategorier");
  return result;
}

export async function createLocalityAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    await createLocality(await getActor(), createLocalitySchema.parse(raw));
  }, raw);
  if (result.status === "ok") saved(raw, "/admin/steder");
  return result;
}

export async function updateLocalityAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => updateLocality(await getActor(), updateLocalitySchema.parse(raw)), raw);
  if (result.status === "ok") saved(raw, "/admin/steder");
  return result;
}

export async function flagAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => setFlag(await getActor(), flagSchema.parse(raw)), raw);
  if (result.status === "ok") saved(raw, "/admin/flagg");
  return result;
}

export async function transparencyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(
    async () => saveTransparencyMonth(await getActor(), transparencySchema.parse(raw)),
    raw,
  );
  if (result.status === "ok") saved(raw, "/admin/apenhet");
  return result;
}

export async function removeTransparencyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(
    async () => removeTransparencyMonth(await getActor(), removeTransparencySchema.parse(raw)),
    raw,
  );
  if (result.status === "ok") saved(raw, "/admin/apenhet");
  return result;
}
