"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localePath } from "@/i18n/page";
import { requireUser } from "@/modules/auth/actor";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";
import { reviewSchema, submitReview } from "./service";

/** «Send vurdering»: the review stays sealed until both have written or the window ends. */
export async function submitReviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = reviewSchema.parse(raw);
    return { bookingId: input.bookingId, outcome: await submitReview(await requireUser(), input) };
  }, raw);
  if (result.status !== "ok" || !result.data) return result as ActionState;
  revalidatePath("/[locale]", "layout");
  const locale = raw.locale === "en" ? "en" : "nb";
  redirect(`${localePath(locale, `/leieforhold/${result.data.bookingId}/vurdering`)}?ok=${result.data.outcome}`);
}
