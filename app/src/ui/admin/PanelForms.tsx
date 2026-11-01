"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import {
  categoryAction,
  categoryPolicyAction,
  createLocalityAction,
  flagAction,
  removeTransparencyAction,
  transparencyAction,
  updateLocalityAction,
} from "@/modules/admin/actions";
import { idle, type ActionState } from "@/modules/server/action";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "@/ui/forms/FormMessages";

type Loc = "nb" | "en";
const POLICIES = ["allowed", "restricted", "prohibited"] as const;
const TYPES = ["rent_out", "wanted", "give_away"] as const;

/** Every admin change needs a reason; it is stored in the audit log with the change. */
function ReasonField({ state }: { state: ActionState }) {
  const t = useTranslations("adminPanel");
  const id = useId();
  return (
    <label className="field">
      {t("reason")}
      <span className="field-hint" id={`${id}-hint`}>
        {t("reasonHint")}
      </span>
      <textarea
        name="reason"
        rows={2}
        minLength={10}
        maxLength={500}
        required
        defaultValue={prev(state, "reason")}
        aria-invalid={invalid(state, "reason")}
        aria-describedby={`${id}-hint`}
      />
      <FieldError state={state} name="reason" />
    </label>
  );
}

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

/** Moderators: the policy only. A restricted category needs a safety notice written by an admin first. */
export function CategoryPolicyForm({
  categoryId,
  policy,
  locale,
}: {
  categoryId: string;
  policy: string;
  locale: Loc;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const [state, action] = useActionState(categoryPolicyAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden values={{ categoryId, locale }} />
      <label className="field">
        {t("policy")}
        <select name="policy" defaultValue={prev(state, "policy") ?? policy} aria-invalid={invalid(state, "policy")}>
          {POLICIES.map((p) => (
            <option key={p} value={p}>
              {t(`policyValue.${p}`)}
            </option>
          ))}
        </select>
        <FieldError state={state} name="policy" />
      </label>
      <ReasonField state={state} />
      <SubmitButton className="button button-outline button-sm" pendingLabel={tc("saving")}>
        {t("savePolicy")}
      </SubmitButton>
    </form>
  );
}

export type CategoryFormValues = {
  id: string;
  labelNb: string;
  labelEn: string;
  safetyNb: string;
  safetyEn: string;
  policy: string;
  types: string[];
  allowPaidRental: boolean;
  active: boolean;
  sortOrder: number;
};

/** Admins: the whole category except its slug. */
export function CategoryForm({ c, locale }: { c: CategoryFormValues; locale: Loc }) {
  const t = useTranslations("adminPanel");
  const tl = useTranslations("listing");
  const tc = useTranslations("common");
  const [state, action] = useActionState(categoryAction, idle);
  const checked = (name: string, initial: boolean) =>
    state.status === "error" ? state.values?.[name] === "on" : initial;
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden values={{ categoryId: c.id, locale }} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          {t("labelNb")}
          <input name="labelNb" required maxLength={60} defaultValue={prev(state, "labelNb") ?? c.labelNb} />
          <FieldError state={state} name="labelNb" />
        </label>
        <label className="field">
          {t("labelEn")}
          <input name="labelEn" required maxLength={60} defaultValue={prev(state, "labelEn") ?? c.labelEn} />
          <FieldError state={state} name="labelEn" />
        </label>
      </div>
      <label className="field">
        {t("policy")}
        <select name="policy" defaultValue={prev(state, "policy") ?? c.policy}>
          {POLICIES.map((p) => (
            <option key={p} value={p}>
              {t(`policyValue.${p}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {t("safetyNb")}
        <textarea name="safetyNb" rows={2} maxLength={600} defaultValue={prev(state, "safetyNb") ?? c.safetyNb} />
        <FieldError state={state} name="safetyNb" />
      </label>
      <label className="field">
        {t("safetyEn")}
        <textarea name="safetyEn" rows={2} maxLength={600} defaultValue={prev(state, "safetyEn") ?? c.safetyEn} />
      </label>
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 font-bold">{t("types")}</legend>
        {TYPES.map((ty) => (
          <label key={ty} className="check">
            <input type="checkbox" name="types" value={ty} defaultChecked={c.types.includes(ty)} />
            <span>{tl(`type.${ty}`)}</span>
          </label>
        ))}
        <FieldError state={state} name="types" />
      </fieldset>
      <label className="check">
        <input type="checkbox" name="allowPaidRental" defaultChecked={checked("allowPaidRental", c.allowPaidRental)} />
        <span>{t("allowPaidRental")}</span>
      </label>
      <label className="check">
        <input type="checkbox" name="active" defaultChecked={checked("active", c.active)} />
        <span>{t("active")}</span>
      </label>
      <label className="field max-w-40">
        {t("sortOrder")}
        <input
          name="sortOrder"
          type="number"
          min={0}
          max={999}
          required
          defaultValue={prev(state, "sortOrder") ?? c.sortOrder}
        />
        <FieldError state={state} name="sortOrder" />
      </label>
      <ReasonField state={state} />
      <SubmitButton className="button button-primary button-sm" pendingLabel={tc("saving")}>
        {t("saveCategory")}
      </SubmitButton>
    </form>
  );
}

export function CreateLocalityForm({ locale }: { locale: Loc }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const [state, action] = useActionState(createLocalityAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden values={{ locale }} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          {t("localityName")}
          <input name="name" required maxLength={60} defaultValue={prev(state, "name")} />
          <FieldError state={state} name="name" />
        </label>
        <label className="field">
          {t("slug")}
          <span className="field-hint">{t("slugHint")}</span>
          <input
            name="slug"
            required
            pattern="[a-z0-9\-]{2,40}"
            maxLength={40}
            defaultValue={prev(state, "slug")}
            aria-invalid={invalid(state, "slug")}
          />
          <FieldError state={state} name="slug" />
        </label>
        <label className="field">
          {t("municipality")}
          <input name="municipality" required maxLength={60} defaultValue={prev(state, "municipality") ?? "Steigen"} />
          <FieldError state={state} name="municipality" />
        </label>
        <label className="field">
          {t("sortOrder")}
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            required
            defaultValue={prev(state, "sortOrder") ?? 0}
          />
          <FieldError state={state} name="sortOrder" />
        </label>
      </div>
      <ReasonField state={state} />
      <SubmitButton className="button button-primary button-sm" pendingLabel={tc("saving")}>
        {t("addLocality")}
      </SubmitButton>
    </form>
  );
}

export function LocalityForm({
  l,
  locale,
}: {
  l: { id: string; name: string; municipality: string; active: boolean; sortOrder: number };
  locale: Loc;
}) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const [state, action] = useActionState(updateLocalityAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden values={{ localityId: l.id, locale }} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="field">
          {t("localityName")}
          <input name="name" required maxLength={60} defaultValue={prev(state, "name") ?? l.name} />
          <FieldError state={state} name="name" />
        </label>
        <label className="field">
          {t("municipality")}
          <input
            name="municipality"
            required
            maxLength={60}
            defaultValue={prev(state, "municipality") ?? l.municipality}
          />
        </label>
        <label className="field">
          {t("sortOrder")}
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            required
            defaultValue={prev(state, "sortOrder") ?? l.sortOrder}
          />
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="active"
          defaultChecked={state.status === "error" ? state.values?.active === "on" : l.active}
        />
        <span>{t("localityActive")}</span>
      </label>
      <ReasonField state={state} />
      <SubmitButton className="button button-outline button-sm" pendingLabel={tc("saving")}>
        {tc("save")}
      </SubmitButton>
    </form>
  );
}

/** Switch one flag to the other value, with a reason. */
export function FlagForm({ flagKey, enabled, locale }: { flagKey: string; enabled: boolean; locale: Loc }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const [state, action] = useActionState(flagAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden values={{ key: flagKey, enabled: String(!enabled), locale }} />
      <ReasonField state={state} />
      <SubmitButton
        className={`button button-sm ${enabled ? "button-outline" : "button-primary"}`}
        pendingLabel={tc("saving")}
      >
        {enabled ? t("turnOff") : t("turnOn")}
      </SubmitButton>
    </form>
  );
}

export type TransparencyFormValues = {
  month: string;
  costTotal: string;
  costServer: string;
  costBackup: string;
  costEmail: string;
  costDomain: string;
  costOther: string;
  supportReceived: string;
  note: string;
  sourceNote: string;
};

const AMOUNTS = [
  ["costTotalOre", "costTotal", true],
  ["costServerOre", "costServer", false],
  ["costBackupOre", "costBackup", false],
  ["costEmailOre", "costEmail", false],
  ["costDomainOre", "costDomain", false],
  ["costOtherOre", "costOther", false],
  ["supportReceivedOre", "supportReceived", false],
] as const;

/** One month of real figures (from invoices and the fundraising payout statement). Same month again = correction. */
export function TransparencyForm({ locale, initial }: { locale: Loc; initial?: TransparencyFormValues }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const [state, action] = useActionState(transparencyAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden values={{ locale }} />
      <label className="field max-w-60">
        {t("month")}
        <input
          name="month"
          type="month"
          required
          defaultValue={prev(state, "month") ?? initial?.month}
          aria-invalid={invalid(state, "month")}
        />
        <FieldError state={state} name="month" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {AMOUNTS.map(([name, key, required]) => (
          <label key={name} className="field">
            {t(`amount.${key}`)}
            <input
              name={name}
              inputMode="decimal"
              required={required}
              placeholder={required ? undefined : t("optionalAmount")}
              defaultValue={prev(state, name) ?? initial?.[key]}
              aria-invalid={invalid(state, name)}
            />
            <FieldError state={state} name={name} />
          </label>
        ))}
      </div>
      <p className="field-hint">{t("amountHint")}</p>
      <label className="field">
        {t("publicNote")}
        <textarea name="note" rows={2} maxLength={500} defaultValue={prev(state, "note") ?? initial?.note} />
      </label>
      <label className="field">
        {t("sourceNote")}
        <span className="field-hint">{t("sourceNoteHint")}</span>
        <textarea
          name="sourceNote"
          rows={2}
          maxLength={500}
          defaultValue={prev(state, "sourceNote") ?? initial?.sourceNote}
        />
      </label>
      <ReasonField state={state} />
      <SubmitButton className="button button-primary button-sm" pendingLabel={tc("saving")}>
        {t("saveMonth")}
      </SubmitButton>
    </form>
  );
}

export function RemoveTransparencyForm({ monthId, locale }: { monthId: string; locale: Loc }) {
  const t = useTranslations("adminPanel");
  const tc = useTranslations("common");
  const [state, action] = useActionState(removeTransparencyAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <Hidden values={{ monthId, locale }} />
      <ReasonField state={state} />
      <SubmitButton className="button button-danger button-sm" pendingLabel={tc("saving")}>
        {t("removeMonth")}
      </SubmitButton>
    </form>
  );
}
