"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitReviewAction } from "@/modules/reviews/actions";
import { idle, type ActionState } from "@/modules/server/action";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, prev } from "@/ui/forms/FormMessages";

const OWNER_KEYS = ["communication", "punctuality", "itemCondition", "agreement"] as const;
const RENTER_KEYS = ["communication", "punctuality", "accuracy", "itemCondition", "agreement"] as const;

/** One 1–5 scale as a radio group: works with the keyboard and screen readers. */
function Scale({ name, state }: { name: string; state: ActionState }) {
  const t = useTranslations("reviews");
  const chosen = prev(state, name);
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 font-bold">{t(`criteria.${name}`)}</legend>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="check rounded-md border border-border px-3 py-2">
            <input type="radio" name={name} value={n} required defaultChecked={chosen === String(n)} />
            <span>
              {n}
              <span className="visually-hidden"> – {t(`scale.${n}`)}</span>
            </span>
          </label>
        ))}
      </div>
      <FieldError state={state} name={name} />
    </fieldset>
  );
}

export function ReviewForm({
  bookingId,
  role,
  locale,
}: {
  bookingId: string;
  role: "owner" | "renter";
  locale: "nb" | "en";
}) {
  const t = useTranslations("reviews");
  const tc = useTranslations("common");
  const [state, action] = useActionState(submitReviewAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="locale" value={locale} />
      <p className="field-hint">{t("scaleHint")}</p>
      {(role === "renter" ? RENTER_KEYS : OWNER_KEYS).map((k) => (
        <Scale key={k} name={k} state={state} />
      ))}
      <label className="field">
        <span>
          {t("comment")} <span className="text-muted">({tc("optional")})</span>
        </span>
        <textarea name="comment" rows={4} maxLength={1000} defaultValue={prev(state, "comment")} />
        <span className="field-hint">{t("commentHint")}</span>
        <FieldError state={state} name="comment" />
      </label>
      <p className="fine-print">{t("blindNote")}</p>
      <SubmitButton pendingLabel={tc("sending")}>{t("submit")}</SubmitButton>
    </form>
  );
}
