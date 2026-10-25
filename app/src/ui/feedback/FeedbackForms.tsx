"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { markFeedbackHandledAction, sendFeedbackAction } from "@/modules/feedback/actions";
import { idle } from "@/modules/server/action";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "@/ui/forms/FormMessages";

const KINDS = ["error", "suggestion", "other"] as const;

export function FeedbackForm({ locale, pagePath }: { locale: "nb" | "en"; pagePath: string | null }) {
  const t = useTranslations("feedback");
  const tc = useTranslations("common");
  const [state, action] = useActionState(sendFeedbackAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      {pagePath && <input type="hidden" name="pagePath" value={pagePath} />}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("kindLabel")}</legend>
        {KINDS.map((k) => (
          <label key={k} className="check">
            <input
              type="radio"
              name="kind"
              value={k}
              required
              defaultChecked={(prev(state, "kind") ?? "error") === k}
            />
            {t(`kind.${k}`)}
          </label>
        ))}
        <FieldError state={state} name="kind" />
      </fieldset>
      <label className="field">
        {t("bodyLabel")}
        <span className="field-hint" id="feedback-hint">
          {t("bodyHint")}
        </span>
        <textarea
          name="body"
          rows={6}
          minLength={3}
          maxLength={2000}
          required
          defaultValue={prev(state, "body")}
          aria-invalid={invalid(state, "body")}
          aria-describedby="feedback-hint"
        />
        <FieldError state={state} name="body" />
      </label>
      {pagePath && <p className="text-sm text-muted">{t("fromPage", { path: pagePath })}</p>}
      <SubmitButton pendingLabel={tc("sending")}>{t("send")}</SubmitButton>
    </form>
  );
}

export function MarkHandledForm({ feedbackId, locale }: { feedbackId: string; locale: "nb" | "en" }) {
  const t = useTranslations("feedback");
  const tc = useTranslations("common");
  const [state, action] = useActionState(markFeedbackHandledAction, idle);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <SubmitButton className="button button-outline button-sm" pendingLabel={tc("saving")}>
        {t("markHandled")}
      </SubmitButton>
    </form>
  );
}
