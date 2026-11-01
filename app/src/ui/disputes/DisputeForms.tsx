"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  documentationAction,
  openDisputeAction,
  proposalAction,
  recommendAction,
  referenceAction,
  reopenAction,
  staffCloseAction,
  statementAction,
  supportNoteAction,
  takeCaseAction,
  uploadDisputePhotoAction,
} from "@/modules/disputes/actions";
import { idle, type ActionState } from "@/modules/server/action";
import { Notice } from "@/ui/Notice";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "@/ui/forms/FormMessages";
import { PhotoPicker } from "@/ui/rentals/ConditionForms";

type Loc = "nb" | "en";
const CATEGORIES = [
  "damaged",
  "not_returned",
  "not_as_described",
  "missing_accessories",
  "late_return",
  "payment_disagreement",
  "deposit_disagreement",
  "unsafe_equipment",
  "other",
] as const;
const PROPOSALS = [
  "no_compensation",
  "repair",
  "replace_accessory",
  "partial_compensation",
  "full_compensation",
  "extra_return_time",
  "other",
] as const;
const MAX_CASE_PHOTOS = 6;

function Hidden({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

/** «Meld fra om et problem»: safety first for unsafe equipment (DISPUTE_POLICY §2 step 1). */
export function OpenDisputeForm({ bookingId, locale }: { bookingId: string; locale: Loc }) {
  const t = useTranslations("disputes");
  const tc = useTranslations("common");
  const [state, action] = useActionState(openDisputeAction, idle);
  const [category, setCategory] = useState(prev(state, "category") ?? "");
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <Hidden fields={{ bookingId, locale }} />
      <label className="field">
        {t("category")}
        <select
          name="category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-invalid={invalid(state, "category")}
        >
          <option value="">–</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
        <FieldError state={state} name="category" />
      </label>
      {category === "unsafe_equipment" && (
        <Notice tone="danger" role="alert">
          <p className="font-bold">{t("safetyTitle")}</p>
          <p>{t("safetyText")}</p>
        </Notice>
      )}
      <label className="field">
        {t("summary")}
        <textarea
          name="summary"
          rows={5}
          minLength={10}
          maxLength={4000}
          required
          defaultValue={prev(state, "summary")}
          aria-invalid={invalid(state, "summary")}
        />
        <span className="field-hint">{t("summaryHint")}</span>
        <FieldError state={state} name="summary" />
      </label>
      <PhotoPicker upload={uploadDisputePhotoAction} max={MAX_CASE_PHOTOS} />
      <p className="fine-print">{t("deadlinesNote")}</p>
      <SubmitButton className="button button-primary w-full" pendingLabel={tc("sending")}>
        {t("open")}
      </SubmitButton>
    </form>
  );
}

export function StatementForm({ disputeId, locale }: { disputeId: string; locale: Loc }) {
  const t = useTranslations("disputes");
  const tc = useTranslations("common");
  const [state, action] = useActionState(statementAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <Hidden fields={{ disputeId, locale }} />
      <label className="field">
        {t("statement")}
        <textarea name="body" rows={4} maxLength={4000} defaultValue={prev(state, "body")} />
        <span className="field-hint">{t("statementHint")}</span>
        <FieldError state={state} name="body" />
      </label>
      <PhotoPicker upload={uploadDisputePhotoAction} max={MAX_CASE_PHOTOS} />
      <SubmitButton className="button button-primary" pendingLabel={tc("sending")}>
        {t("addStatement")}
      </SubmitButton>
    </form>
  );
}

/** Attach one message from the booking conversation to the case. */
export function ReferenceForm({
  disputeId,
  locale,
  messages,
}: {
  disputeId: string;
  locale: Loc;
  messages: { id: string; label: string }[];
}) {
  const t = useTranslations("disputes");
  const tc = useTranslations("common");
  const [state, action] = useActionState(referenceAction, idle);
  if (!messages.length) return <p className="text-sm text-muted">{t("noMessagesToAttach")}</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden fields={{ disputeId, locale }} />
      <label className="field">
        {t("attachMessage")}
        <select name="messageId" required defaultValue="">
          <option value="">–</option>
          {messages.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="field-hint">{t("attachMessageHint")}</span>
      </label>
      <SubmitButton className="button button-outline" pendingLabel={tc("sending")}>
        {t("attach")}
      </SubmitButton>
    </form>
  );
}

export function ProposalForm({ disputeId, locale }: { disputeId: string; locale: Loc }) {
  const t = useTranslations("disputes");
  const tc = useTranslations("common");
  const [state, action] = useActionState(proposalAction, idle);
  const [type, setType] = useState(prev(state, "type") ?? "");
  const money = type === "partial_compensation" || type === "full_compensation";
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <Hidden fields={{ disputeId, locale }} />
      <label className="field">
        {t("proposalType")}
        <select name="type" required value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">–</option>
          {PROPOSALS.map((p) => (
            <option key={p} value={p}>
              {t(`proposalTypes.${p}`)}
            </option>
          ))}
        </select>
        <FieldError state={state} name="type" />
      </label>
      {money && (
        <label className="field">
          {t("amount")}
          <input
            name="amount"
            inputMode="decimal"
            required
            defaultValue={prev(state, "amount")}
            aria-invalid={invalid(state, "amount")}
          />
          <FieldError state={state} name="amount" />
        </label>
      )}
      {type === "extra_return_time" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            {t("newReturnDate")}
            <input type="date" name="returnDate" required defaultValue={prev(state, "returnDate")} />
          </label>
          <label className="field">
            {t("newReturnTime")}
            <input
              type="time"
              name="returnTime"
              required
              step={900}
              defaultValue={prev(state, "returnTime") ?? "18:00"}
            />
          </label>
          <div className="col-span-2">
            <FieldError state={state} name="newReturnAt" />
          </div>
        </div>
      )}
      <label className="field">
        {t("proposalText")}
        <textarea name="text" rows={3} maxLength={2000} required defaultValue={prev(state, "text")} />
        <span className="field-hint">{t("proposalHint")}</span>
        <FieldError state={state} name="text" />
      </label>
      <p className="fine-print">{t("noMoneyThroughLaandet")}</p>
      <SubmitButton className="button button-primary" pendingLabel={tc("sending")}>
        {t("propose")}
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------- staff

function ReasonForm({
  action,
  fields,
  label,
  fieldLabel,
  name = "reason",
  rows = 2,
  max = 500,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  fieldLabel: string;
  name?: string;
  rows?: number;
  max?: number;
}) {
  const tc = useTranslations("common");
  const [state, formAction] = useActionState(action, idle);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden fields={fields} />
      <label className="field">
        {fieldLabel}
        <textarea name={name} rows={rows} minLength={10} maxLength={max} required defaultValue={prev(state, name)} />
        <FieldError state={state} name={name} />
      </label>
      <SubmitButton className="button button-outline" pendingLabel={tc("sending")}>
        {label}
      </SubmitButton>
    </form>
  );
}

export function TakeCaseForm({ disputeId, locale }: { disputeId: string; locale: Loc }) {
  const t = useTranslations("disputes");
  return (
    <ReasonForm
      action={takeCaseAction}
      fields={{ disputeId, locale }}
      label={t("staff.take")}
      fieldLabel={t("staff.takeReason")}
    />
  );
}

export function ReopenForm({ disputeId, locale }: { disputeId: string; locale: Loc }) {
  const t = useTranslations("disputes");
  return (
    <ReasonForm
      action={reopenAction}
      fields={{ disputeId, locale }}
      label={t("staff.reopen")}
      fieldLabel={t("staff.reopenReason")}
    />
  );
}

export function DocumentationForm({ disputeId, locale }: { disputeId: string; locale: Loc }) {
  const t = useTranslations("disputes");
  return (
    <ReasonForm
      action={documentationAction}
      fields={{ disputeId, locale }}
      label={t("staff.requestDocs")}
      fieldLabel={t("staff.requestDocsText")}
      name="body"
      rows={3}
      max={4000}
    />
  );
}

export function SupportNoteForm({ disputeId, locale }: { disputeId: string; locale: Loc }) {
  const t = useTranslations("disputes");
  const tc = useTranslations("common");
  const [state, action] = useActionState(supportNoteAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden fields={{ disputeId, locale }} />
      <label className="field">
        {t("staff.note")}
        <textarea name="body" rows={3} maxLength={4000} required defaultValue={prev(state, "body")} />
        <FieldError state={state} name="body" />
      </label>
      <label className="field">
        {t("staff.visibility")}
        <select name="visibility" defaultValue="parties">
          <option value="parties">{t("staff.visibleToParties")}</option>
          <option value="staff_only">{t("staff.staffOnly")}</option>
        </select>
      </label>
      <SubmitButton className="button button-outline" pendingLabel={tc("sending")}>
        {t("staff.addNote")}
      </SubmitButton>
    </form>
  );
}

/** The recommendation template keeps facts, disagreements and the (non-binding) advice apart. */
export function RecommendForm({ disputeId, locale }: { disputeId: string; locale: Loc }) {
  const t = useTranslations("disputes");
  const tc = useTranslations("common");
  const [state, action] = useActionState(recommendAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden fields={{ disputeId, locale }} />
      {(["documented", "disagreed", "recommendation"] as const).map((k) => (
        <label key={k} className="field">
          {t(`recommendation.${k}`)}
          <textarea name={k} rows={3} maxLength={1300} required defaultValue={prev(state, k)} />
          <FieldError state={state} name={k} />
        </label>
      ))}
      <SubmitButton className="button button-primary" pendingLabel={tc("sending")}>
        {t("staff.recommend")}
      </SubmitButton>
    </form>
  );
}

export function StaffCloseForm({ disputeId, locale }: { disputeId: string; locale: Loc }) {
  const t = useTranslations("disputes");
  const tc = useTranslations("common");
  const [state, action] = useActionState(staffCloseAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden fields={{ disputeId, locale }} />
      <label className="field">
        {t("staff.outcome")}
        <select name="outcome" required defaultValue="closed_without_agreement">
          {(["closed_without_agreement", "referred_to_insurer", "referred_to_authority"] as const).map((o) => (
            <option key={o} value={o}>
              {t(`status.${o}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {t("staff.closureNote")}
        <textarea name="note" rows={3} minLength={10} maxLength={4000} required defaultValue={prev(state, "note")} />
        <FieldError state={state} name="note" />
      </label>
      <SubmitButton className="button button-outline" pendingLabel={tc("sending")}>
        {t("staff.close")}
      </SubmitButton>
    </form>
  );
}
