"use client";

import { useActionState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { markFeedbackHandledAction, sendFeedbackAction } from "@/modules/feedback/actions";
import { idle } from "@/modules/server/action";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "@/ui/forms/FormMessages";

const KINDS = ["error", "suggestion", "other"] as const;

const noSubscription = () => () => {};

/** The page the person came from (same site only, path without query), so staff know where it happened. */
function referrerPath(): string {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    return ref && ref.origin === window.location.origin ? ref.pathname : "";
  } catch {
    return "";
  }
}

export function FeedbackForm({ locale }: { locale: "nb" | "en" }) {
  const t = useTranslations("feedback");
  const tc = useTranslations("common");
  const [state, action] = useActionState(sendFeedbackAction, idle);
  // Empty on the server; the browser fills it in after hydration.
  const pagePath = useSyncExternalStore(noSubscription, referrerPath, () => "");
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="pagePath" value={pagePath} />
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
