"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { sendMessageAction } from "@/modules/messaging/actions";
import { MESSAGE_MAX_LENGTH, paymentWarning } from "@/modules/messaging/rules";
import { idle } from "@/modules/server/action";
import { FieldError, prev } from "@/ui/forms/FormMessages";
import { Notice } from "@/ui/Notice";
import { MessagingFormError } from "./MessagingFormError";

/** First message about a listing; on success the server opens the conversation. */
export function ContactForm({
  listingId,
  locale,
  ownListings,
}: {
  listingId: string;
  locale: "nb" | "en";
  /** For replies to «Ønskes leid»: the sender's own published «Leies ut» listings (D-020). */
  ownListings: { id: string; title: string }[] | null;
}) {
  const t = useTranslations("inbox");
  const [state, dispatch, pending] = useActionState(sendMessageAction, idle);
  const [draft, setDraft] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }

  return (
    <form onSubmit={onSubmit} method="post" className="flex flex-col gap-3">
      <MessagingFormError state={state} />
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="from" value="listing" />
      <input type="hidden" name="locale" value={locale} />
      <label className="field">
        {t("writeLabel")}
        <span className="field-hint">{t("writeHint")}</span>
        <textarea
          name="body"
          rows={4}
          maxLength={MESSAGE_MAX_LENGTH}
          required
          defaultValue={prev(state, "body")}
          onChange={(e) => setDraft(e.target.value)}
        />
        <FieldError state={state} name="body" />
      </label>
      {ownListings && ownListings.length > 0 && (
        <label className="field">
          {t("attachLabel")}
          <select name="attachedListingId" defaultValue={prev(state, "attachedListingId") ?? ""}>
            <option value="">{t("attachNone")}</option>
            {ownListings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {paymentWarning(draft) && <Notice tone="warning">{t("paymentWarningSender")}</Notice>}
      <button type="submit" className="button button-primary" disabled={pending}>
        {pending ? t("sending") : t("contactButton")}
      </button>
    </form>
  );
}
