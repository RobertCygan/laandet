"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { acceptTermsAction } from "@/modules/legal/actions";
import { idle } from "@/modules/server/action";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError } from "./FormMessages";

export function AcceptTermsForm({ locale, next }: { locale: "nb" | "en"; next?: string }) {
  const t = useTranslations("legalPage");
  const [state, action] = useActionState(acceptTermsAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <label className="check">
        <input type="checkbox" name="confirm" required />
        <span>{t("acceptCheckbox")}</span>
      </label>
      <FieldError state={state} name="confirm" />
      <SubmitButton>{t("acceptButton")}</SubmitButton>
    </form>
  );
}
