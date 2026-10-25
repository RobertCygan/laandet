"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  decideAppealAction,
  dismissReportAction,
  hideListingAction,
  userMeasureAction,
} from "@/modules/moderation/actions";
import { idle } from "@/modules/server/action";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "@/ui/forms/FormMessages";

const HIDE_REASONS = [
  "prohibited_item",
  "misleading",
  "unsafe",
  "fraud_or_scam",
  "illegal_content",
  "privacy",
  "other",
] as const;

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
        <select
          name="reasonCode"
          required
          defaultValue={prev(state, "reasonCode") ?? ""}
          aria-invalid={invalid(state, "reasonCode")}
        >
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
        <textarea
          name="statement"
          rows={4}
          minLength={10}
          maxLength={4000}
          required
          defaultValue={prev(state, "statement")}
          aria-invalid={invalid(state, "statement")}
        />
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
        <textarea
          name="decision"
          rows={4}
          minLength={10}
          maxLength={4000}
          required
          defaultValue={prev(state, "decision")}
          aria-invalid={invalid(state, "decision")}
        />
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

const USER_REASONS = [
  "fraud_or_scam",
  "harassment",
  "not_returned",
  "unsafe",
  "spam",
  "illegal_content",
  "repeated_violations",
  "other",
] as const;

/** Account measure with a statement of reasons (sent to the user, who can appeal). */
export function UserMeasureForm({ userId, reportId, back }: { userId: string; reportId?: string; back: string }) {
  const t = useTranslations("admin");
  const [state, action] = useActionState(userMeasureAction, idle);
  const [measure, setMeasure] = useState(prev(state, "measure") ?? "warn");
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="back" value={back} />
      {reportId && <input type="hidden" name="reportId" value={reportId} />}
      <label className="field">
        {t("measure.label")}
        <select name="measure" value={measure} onChange={(e) => setMeasure(e.target.value)}>
          {(["warn", "restrict", "suspend", "reinstate"] as const).map((m) => (
            <option key={m} value={m}>
              {t(`measure.${m}`)}
            </option>
          ))}
        </select>
      </label>
      {measure === "restrict" && (
        <label className="field">
          {t("measure.until")}
          <input type="date" name="untilDate" defaultValue={prev(state, "untilDate")} />
          <span className="field-hint">{t("measure.untilHint")}</span>
          <FieldError state={state} name="until" />
        </label>
      )}
      <label className="field">
        {t("reasonCode")}
        <select name="reasonCode" required defaultValue={prev(state, "reasonCode") ?? ""}>
          <option value="">–</option>
          {USER_REASONS.map((r) => (
            <option key={r} value={r}>
              {t(`measure.reasons.${r}`)}
            </option>
          ))}
        </select>
        <FieldError state={state} name="reasonCode" />
      </label>
      <label className="field">
        {t("statement")}
        <span className="field-hint">{t("measure.statementHint")}</span>
        <textarea
          name="statement"
          rows={4}
          minLength={10}
          maxLength={4000}
          required
          defaultValue={prev(state, "statement")}
          aria-invalid={invalid(state, "statement")}
        />
        <FieldError state={state} name="statement" />
      </label>
      <SubmitButton className="button button-danger button-sm">{t("measure.submit")}</SubmitButton>
    </form>
  );
}
