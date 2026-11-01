"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/modules/auth/password-rules";
import type { ActionState } from "@/modules/server/action";
import { FieldError, invalid } from "./FormMessages";

/**
 * A password input with «Vis passord» (ASVS 2.1.12, D-056). The toggle sits outside the label and has no
 * aria-label, so the field is still found by its label alone. A new password gets the length limits.
 */
export function PasswordField({
  label,
  name,
  autoComplete,
  hint,
  state,
}: {
  label: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  /** Pass the form state to show this field's error and mark it invalid. */
  state?: ActionState<unknown>;
}) {
  const t = useTranslations("auth");
  const id = useId();
  const [shown, setShown] = useState(false);
  const isNew = autoComplete === "new-password";
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {hint && <span className="field-hint block">{hint}</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          className="min-w-0 flex-1"
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={isNew ? PASSWORD_MIN : undefined}
          maxLength={isNew ? PASSWORD_MAX : undefined}
          aria-invalid={state ? invalid(state, name) : undefined}
          aria-describedby={state ? `${name}-error` : undefined}
          spellCheck={false}
          autoCapitalize="none"
        />
        <button
          type="button"
          className="button button-subtle button-sm shrink-0"
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? t("hidePassword") : t("showPassword")}
        </button>
      </div>
      {state && <FieldError state={state} name={name} />}
    </div>
  );
}
