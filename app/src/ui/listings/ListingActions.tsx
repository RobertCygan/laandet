"use client";

import { useActionState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { appealAction, reportAction } from "@/modules/moderation/actions";
import { idle } from "@/modules/server/action";
import { Notice } from "@/ui/Notice";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "@/ui/forms/FormMessages";

const REASONS = [
  "prohibited_item",
  "fraud_or_scam",
  "misleading",
  "harassment",
  "spam",
  "illegal_content",
  "privacy",
  "unsafe",
  "other",
] as const;

/** Report form for a listing, a profile or a message (anonymous to the reported person). */
export function ReportForm({
  targetType,
  targetId,
}: {
  targetType: "listing" | "user" | "message" | "review";
  targetId: string;
}) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const [state, action] = useActionState(reportAction, idle);
  if (state.status === "ok") {
    return (
      <Notice tone="success" role="status">
        {t("done")}
      </Notice>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("lead")}</p>
      <FormError state={state} />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <label className="field">
        {t("reason")}
        <select
          name="reason"
          defaultValue={prev(state, "reason") ?? ""}
          required
          aria-invalid={invalid(state, "reason")}
        >
          <option value="">–</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {t(`reasons.${r}`)}
            </option>
          ))}
        </select>
        <FieldError state={state} name="reason" />
      </label>
      <label className="field">
        {t("details")}
        <textarea name="details" rows={3} maxLength={2000} defaultValue={prev(state, "details")} />
        <FieldError state={state} name="details" />
      </label>
      <label className="check">
        <input type="checkbox" name="goodFaith" required defaultChecked={prev(state, "goodFaith") === "on"} />
        <span>{t("goodFaith")}</span>
      </label>
      <FieldError state={state} name="goodFaith" />
      <SubmitButton className="button button-outline" pendingLabel={tc("sending")}>
        {t("submit")}
      </SubmitButton>
    </form>
  );
}

export function AppealForm({ actionId }: { actionId: string }) {
  const t = useTranslations("moderation");
  const tc = useTranslations("common");
  const [state, action] = useActionState(appealAction, idle);
  if (state.status === "ok") {
    return (
      <Notice tone="success" role="status">
        {t("appealSent")}
      </Notice>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <input type="hidden" name="actionId" value={actionId} />
      <label className="field">
        {t("appealText")}
        <textarea
          name="text"
          rows={6}
          minLength={10}
          maxLength={4000}
          required
          defaultValue={prev(state, "text")}
          aria-invalid={invalid(state, "text")}
        />
        <FieldError state={state} name="text" />
      </label>
      <SubmitButton pendingLabel={tc("sending")}>{t("appealButton")}</SubmitButton>
    </form>
  );
}

/** Submit button that asks for confirmation first (e.g. deleting a listing). */
export function ConfirmButton({
  message,
  className,
  children,
}: {
  message: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
