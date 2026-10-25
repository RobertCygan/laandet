"use client";

import { useTranslations } from "next-intl";
import type { ActionState } from "@/modules/server/action";
import { FormError } from "@/ui/forms/FormMessages";
import { Notice } from "@/ui/Notice";

/** Messaging-specific error texts live in `inbox.errors`; everything else falls back to the shared form error. */
export function MessagingFormError({ state }: { state: ActionState<unknown> }) {
  const t = useTranslations("inbox");
  if (state.status === "error" && state.detail && t.has(`errors.${state.detail}`)) {
    return (
      <Notice tone="danger" role="alert">
        <p>{t(`errors.${state.detail}` as "errors.blocked")}</p>
      </Notice>
    );
  }
  return <FormError state={state} />;
}
