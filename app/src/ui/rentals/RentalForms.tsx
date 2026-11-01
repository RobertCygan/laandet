"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { PriceUnit } from "@/db/schema";
import { formatKr, osloLocalToDate } from "@/i18n/format";
import {
  acceptAgreementAction,
  cancelBookingAction,
  changeTermsAction,
  meetingPlaceAction,
  requestBookingAction,
} from "@/modules/rentals/actions";
import { periodError, totalOre, units } from "@/modules/rentals/pricing";
import { idle, type ActionState } from "@/modules/server/action";
import { Notice } from "@/ui/Notice";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "@/ui/forms/FormMessages";

type Loc = "nb" | "en";
type Method = "pickup" | "owner_delivery" | "meet";
type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * A one-button form for a server action with hidden fields (accept, decline, select, …).
 * Errors are shown above the button; on success the action redirects.
 */
export function StepForm({
  action,
  fields,
  label,
  className = "button button-primary",
  children,
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  const tc = useTranslations("common");
  const [state, formAction] = useActionState(action, idle);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <FormError state={state} />
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <SubmitButton className={className} pendingLabel={tc("sending")}>
        {label}
      </SubmitButton>
    </form>
  );
}

function PeriodFields({
  state,
  initial,
}: {
  state: ActionState;
  initial?: { startDate: string; startTime: string; endDate: string; endTime: string };
}) {
  const t = useTranslations("rentals");
  return (
    <fieldset className="grid grid-cols-2 gap-3 border-0 p-0">
      <legend className="mb-1 font-bold">{t("period")}</legend>
      <label className="field">
        {t("startDate")}
        <input
          type="date"
          name="startDate"
          required
          defaultValue={prev(state, "startDate") ?? initial?.startDate}
          aria-invalid={invalid(state, "start")}
        />
      </label>
      <label className="field">
        {t("startTime")}
        <input
          type="time"
          name="startTime"
          required
          step={900}
          defaultValue={prev(state, "startTime") ?? initial?.startTime ?? "10:00"}
        />
      </label>
      <label className="field">
        {t("endDate")}
        <input
          type="date"
          name="endDate"
          required
          defaultValue={prev(state, "endDate") ?? initial?.endDate}
          aria-invalid={invalid(state, "end")}
        />
      </label>
      <label className="field">
        {t("endTime")}
        <input
          type="time"
          name="endTime"
          required
          step={900}
          defaultValue={prev(state, "endTime") ?? initial?.endTime ?? "18:00"}
        />
      </label>
      <div className="col-span-2">
        <FieldError state={state} name="start" />
        <FieldError state={state} name="end" />
      </div>
    </fieldset>
  );
}

function MethodSelect({
  name,
  label,
  methods,
  state,
  initial,
}: {
  name: string;
  label: string;
  methods: Method[];
  state: ActionState;
  initial?: Method;
}) {
  const t = useTranslations("rentals");
  return (
    <label className="field">
      {label}
      <select
        name={name}
        required
        defaultValue={prev(state, name) ?? initial ?? methods[0]}
        aria-invalid={invalid(state, name)}
      >
        {methods.map((m) => (
          <option key={m} value={m}>
            {t(`method.${m}`)}
          </option>
        ))}
      </select>
      <FieldError state={state} name={name} />
    </label>
  );
}

/** «Send forespørsel» with a live price preview (P02-02). The agreement comes after acceptance. */
export function RequestForm({
  listingId,
  locale,
  priceOre,
  priceUnit,
  depositOre,
  methods,
}: {
  listingId: string;
  locale: Loc;
  priceOre: number;
  priceUnit: PriceUnit;
  depositOre: number;
  methods: Method[];
}) {
  const t = useTranslations("rentals");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const [state, action] = useActionState(requestBookingAction, idle);
  const [p, setP] = useState({ startDate: "", startTime: "10:00", endDate: "", endTime: "18:00" });
  const start = osloLocalToDate(p.startDate, p.startTime);
  const end = osloLocalToDate(p.endDate, p.endTime);
  const err = start && end ? periodError(start, end, priceUnit) : null;
  const n = start && end && !err ? units(start, end, priceUnit) : null;

  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      onChange={(e) => {
        const f = e.currentTarget.elements;
        const v = (k: string) => (f.namedItem(k) as HTMLInputElement | null)?.value ?? "";
        setP({ startDate: v("startDate"), startTime: v("startTime"), endDate: v("endDate"), endTime: v("endTime") });
      }}
    >
      <FormError state={state} />
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="locale" value={locale} />
      <PeriodFields state={state} />
      <MethodSelect name="handoverMethod" label={t("handoverMethod")} methods={methods} state={state} />
      <MethodSelect name="returnMethod" label={t("returnMethod")} methods={methods} state={state} />
      <label className="field">
        {t("messageOptional")}
        <textarea name="message" rows={3} maxLength={2000} defaultValue={prev(state, "message")} />
        <span className="field-hint">{t("messageHint")}</span>
      </label>
      <div className="card bg-secondary/40 flex flex-col gap-1 p-4" aria-live="polite">
        {err && <p className="field-error">{tv(err)}</p>}
        {n !== null && (
          <p>
            {priceOre === 0
              ? t("freeLoanSummary")
              : t("priceSummary", {
                  unit: t(`units.${priceUnit}`, { n }),
                  total: formatKr(totalOre(priceOre, n)),
                })}
          </p>
        )}
        <p>{depositOre ? t("depositSummary", { amount: formatKr(depositOre) }) : t("noDeposit")}</p>
        <p className="fine-print">{t("afterAccept")}</p>
      </div>
      <Notice tone="warning">{t("paymentWarning")}</Notice>
      <SubmitButton pendingLabel={tc("sending")}>{t("send")}</SubmitButton>
    </form>
  );
}

export function CancelForm({ bookingId, locale }: { bookingId: string; locale: Loc }) {
  const t = useTranslations("rentals");
  const tc = useTranslations("common");
  const [state, action] = useActionState(cancelBookingAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="locale" value={locale} />
      <label className="field">
        {t("cancelReason")}
        <textarea
          name="reason"
          rows={2}
          minLength={3}
          maxLength={500}
          required
          defaultValue={prev(state, "reason")}
          aria-invalid={invalid(state, "reason")}
        />
        <FieldError state={state} name="reason" />
      </label>
      <SubmitButton className="button button-outline" pendingLabel={tc("sending")}>
        {t("cancel")}
      </SubmitButton>
    </form>
  );
}

export function MeetingPlaceForm({ bookingId, locale, current }: { bookingId: string; locale: Loc; current: string }) {
  const t = useTranslations("rentals");
  const tc = useTranslations("common");
  const [state, action] = useActionState(meetingPlaceAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="locale" value={locale} />
      <label className="field">
        {t("meetingPlace")}
        <input name="place" maxLength={200} defaultValue={prev(state, "place") ?? current} />
        <span className="field-hint">{t("meetingPlaceHint")}</span>
        <FieldError state={state} name="place" />
      </label>
      <SubmitButton className="button button-outline" pendingLabel={tc("saving")}>
        {tc("save")}
      </SubmitButton>
    </form>
  );
}

export function ChangeTermsForm({
  bookingId,
  locale,
  methods,
  initial,
}: {
  bookingId: string;
  locale: Loc;
  methods: Method[];
  initial: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    handoverMethod: Method;
    returnMethod: Method;
  };
}) {
  const t = useTranslations("rentals");
  const tc = useTranslations("common");
  const [state, action] = useActionState(changeTermsAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="locale" value={locale} />
      <PeriodFields state={state} initial={initial} />
      <MethodSelect
        name="handoverMethod"
        label={t("handoverMethod")}
        methods={methods}
        state={state}
        initial={initial.handoverMethod}
      />
      <MethodSelect
        name="returnMethod"
        label={t("returnMethod")}
        methods={methods}
        state={state}
        initial={initial.returnMethod}
      />
      <p className="fine-print">{t("changeTermsNote")}</p>
      <SubmitButton className="button button-outline" pendingLabel={tc("sending")}>
        {t("changeTerms")}
      </SubmitButton>
    </form>
  );
}

/** «Jeg godtar avtalen»: posts the hash of the text on the page (P02-04). */
export function AcceptAgreementForm({ bookingId, sha256, locale }: { bookingId: string; sha256: string; locale: Loc }) {
  const t = useTranslations("agreement");
  const tc = useTranslations("common");
  const [state, action] = useActionState(acceptAgreementAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="sha256" value={sha256} />
      <input type="hidden" name="locale" value={locale} />
      <label className="check">
        <input type="checkbox" name="read" required aria-invalid={invalid(state, "read")} />
        <span>{t("readConfirm")}</span>
      </label>
      <FieldError state={state} name="read" />
      <SubmitButton pendingLabel={tc("sending")}>{t("accept")}</SubmitButton>
    </form>
  );
}
