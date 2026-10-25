"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { decideAppealAction, dismissReportAction, hideListingAction } from "@/modules/moderation/actions";
import { idle } from "@/modules/server/action";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "@/ui/forms/FormMessages";

const HIDE_REASONS = ["prohibited_item", "misleading", "unsafe", "fraud_or_scam", "illegal_content", "privacy", "other"] as const;

/** Hide a listing with a statement of reasons (sent to the owner). */
export function HideListingForm({ listingId, reportId, back }: { listingId: string; reportId?: string; back: string }) {
  const t = useTranslations("admin");
  const tr = useTranslations("report");
  const [state, action] = useActionState(hideListingAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="back" value={back} />
      {reportId && <input type="hidden" name="reportId" value={reportId} />}
      <label className="field">
        {t("reasonCode")}
        <select name="reasonCode" required defaultValue={prev(state, "reasonCode") ?? ""} aria-invalid={invalid(state, "reasonCode")}>
          <option value="">–</option>
          {HIDE_REASONS.map((r) => (
            <option key={r} value={r}>
              {tr(`reasons.${r}`)}
            </option>
          ))}
        </select>
        <FieldError state={state} name="reasonCode" />
      </label>
      <label className="field">
        {t("statement")}
        <span className="field-hint">{t("statementHint")}</span>
        <textarea name="statement" rows={4} minLength={10} maxLength={4000} required defaultValue={prev(state, "statement")} aria-invalid={invalid(state, "statement")} />
        <FieldError state={state} name="statement" />
      </label>
      <SubmitButton className="button button-danger button-sm">{t("hide")}</SubmitButton>
    </form>
  );
}

export function DismissReportForm({ reportId, back }: { reportId: string; back: string }) {
  const t = useTranslations("admin");
  const [state, action] = useActionState(dismissReportAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="back" value={back} />
      <label className="field">
        {t("dismissNote")}
        <textarea name="note" rows={2} maxLength={2000} defaultValue={prev(state, "note")} />
      </label>
      <SubmitButton className="button button-outline button-sm">{t("dismiss")}</SubmitButton>
    </form>
  );
}

export function DecideAppealForm({ appealId, back }: { appealId: string; back: string }) {
  const t = useTranslations("admin");
  const [state, action] = useActionState(decideAppealAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <input type="hidden" name="appealId" value={appealId} />
      <input type="hidden" name="back" value={back} />
      <label className="field">
        {t("decision")}
        <textarea name="decision" rows={4} minLength={10} maxLength={4000} required defaultValue={prev(state, "decision")} aria-invalid={invalid(state, "decision")} />
        <FieldError state={state} name="decision" />
      </label>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="outcome" value="upheld" className="button button-outline button-sm">
          {t("decideUpheld")}
        </SubmitButton>
        <SubmitButton name="outcome" value="reversed" className="button button-primary button-sm">
          {t("decideReversed")}
        </SubmitButton>
      </div>
    </form>
  );
}
