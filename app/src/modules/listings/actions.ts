"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/i18n/page";
import { getActor, requireUser } from "@/modules/auth/actor";
import { uploadListingImage, type UploadedMedia } from "@/modules/media/service";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import { listingFormSchema, toDraft } from "./schemas";
import { changeListingStatus, saveListing, toggleSavedListing, type StatusAction } from "./service";

const uuid = z.uuid();

/** Wizard submit: `intent` comes from the clicked button (draft | publish). */
export async function saveListingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const locale = raw.locale === "en" ? "en" : "nb";
  const result = await runAction(async () => {
    const actor = await getActor();
    const values = listingFormSchema.parse(raw);
    const ids = form.getAll("imageId").map(String);
    const alts = form.getAll("imageAlt").map(String);
    const images = ids.map((id, i) => ({ mediaId: uuid.parse(id), altText: alts[i]?.trim() || null }));
    const listingId = raw.listingId ? uuid.parse(raw.listingId) : undefined;
    const intent = raw.intent === "publish" ? "publish" : "draft";
    return saveListing(actor, toDraft(values, images.length), images, { listingId, intent });
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  const { id, status, warnings } = result.data;
  revalidatePath("/[locale]", "layout");
  const warn = warnings.length ? `&advarsel=${warnings.join(",")}` : "";
  // A draft stays in the wizard (same step); a published listing opens its page.
  if (status === "draft") {
    const step = /^[1-5]$/.test(raw.step ?? "") ? raw.step : "1";
    redirect(`${localePath(locale, `/annonse/${id}/rediger`)}?lagret=saved&steg=${step}${warn}`);
  }
  const outcome = raw.listingId ? "updated" : "published";
  redirect(`${localePath(locale, `/annonse/${id}`)}?lagret=${outcome}${warn}`);
}

/** One image per call so progress can be shown and a failure only affects that image. */
export async function uploadImageAction(form: FormData): Promise<ActionState<UploadedMedia>> {
  return runAction(async () => {
    const actor = await requireUser();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new z.ZodError([{ code: "custom", path: ["file"], message: "image_missing", input: file }]);
    return uploadListingImage(actor, file);
  });
}

const statusSchema = z.object({
  listingId: z.uuid(),
  op: z.enum(["pause", "resume", "archive", "delete"]),
  locale: z.enum(["nb", "en"]).default("nb"),
});

export async function changeStatusAction(form: FormData): Promise<void> {
  const { listingId, op, locale } = statusSchema.parse(formToObject(form));
  const actor = await requireUser();
  await changeListingStatus(actor, listingId, op as StatusAction);
  revalidatePath("/[locale]", "layout");
  redirect(localePath(locale, "/mine-annonser"));
}

export async function toggleSaveAction(form: FormData): Promise<void> {
  const raw = formToObject(form);
  const listingId = uuid.parse(raw.listingId);
  const locale = raw.locale === "en" ? "en" : "nb";
  const actor = await getActor();
  if (actor.kind !== "user") {
    redirect(
      `${localePath(locale, "/logg-inn")}?neste=${encodeURIComponent(localePath(locale, `/annonse/${listingId}`))}`,
    );
  }
  await toggleSavedListing(actor, listingId);
  revalidatePath("/[locale]", "layout");
}
