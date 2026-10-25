"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { confirmTransferAction, createClaimAction } from "@/modules/giveaways/actions";
import { idle } from "@/modules/server/action";
import { Notice } from "@/ui/Notice";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "@/ui/forms/FormMessages";

type Loc = "nb" | "en";
type Method = "pickup" | "owner_delivery" | "meet";

/** «Jeg vil gjerne ha den» (P02-03). */
export function ClaimForm({ listingId, locale, methods }: { listingId: string; locale: Loc; methods: Method[] }) {
  const t = useTranslations("claims");
  const tr = useTranslations("rentals");
  const tc = useTranslations("common");
  const [state, action] = useActionState(createClaimAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="locale" value={locale} />
      {methods.length > 1 && (
        <label className="field">
          {t("handoverMethod")}
          <select
            name="handoverMethod"
            defaultValue={prev(state, "handoverMethod") ?? ""}
            aria-invalid={invalid(state, "handoverMethod")}
          >
            <option value="">{t("methodOpen")}</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {tr(`method.${m}`)}
              </option>
            ))}
          </select>
          <FieldError state={state} name="handoverMethod" />
        </label>
      )}
      <label className="field">
        {t("message")}
        <textarea name="message" rows={3} maxLength={2000} defaultValue={prev(state, "message")} />
        <span className="field-hint">{t("messageHint")}</span>
      </label>
      <SubmitButton pendingLabel={tc("sending")}>{t("claim")}</SubmitButton>
      <p className="fine-print">{t("claimNote")}</p>
    </form>
  );
}

/** Each party confirms the exact transfer text after the handover (hash-bound). */
export function ConfirmTransferForm({ claimId, sha256, locale }: { claimId: string; sha256: string; locale: Loc }) {
  const t = useTranslations("claims");
  const tc = useTranslations("common");
  const [state, action] = useActionState(confirmTransferAction, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError state={state} />
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="sha256" value={sha256} />
      <input type="hidden" name="locale" value={locale} />
      <label className="check">
        <input type="checkbox" name="handedOver" required />
        <span>{t("handedOverConfirm")}</span>
      </label>
      <FieldError state={state} name="handedOver" />
      <SubmitButton pendingLabel={tc("sending")}>{t("confirmTransfer")}</SubmitButton>
      <Notice>{t("transferNote")}</Notice>
    </form>
  );
}
