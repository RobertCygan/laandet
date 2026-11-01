"use client";

import { useTranslations } from "next-intl";
import type { ActionState } from "@/modules/server/action";
import { Notice } from "@/ui/Notice";

/** Top-level error for a form (errors.<code>, or errors.<detail> when more specific). */
export function FormError({ state }: { state: ActionState<unknown> }) {
  const t = useTranslations("errors");
  if (state.status !== "error") return null;
  const key = state.detail && t.has(state.detail) ? state.detail : state.code;
  return (
    <Notice tone="danger" role="alert">
      <p>{t.has(key) ? t(key) : t("unexpected")}</p>
    </Notice>
  );
}

export function FieldError({ state, name, id }: { state: ActionState<unknown>; name: string; id?: string }) {
  const t = useTranslations("validation");
  if (state.status !== "error" || !state.fieldErrors?.[name]) return null;
  const code = state.fieldErrors[name]!;
  return (
    <span className="field-error" id={id ?? `${name}-error`} role="alert">
      {t.has(code) ? t(code) : t("required")}
    </span>
  );
}

export function invalid(state: ActionState<unknown>, name: string) {
  return state.status === "error" && Boolean(state.fieldErrors?.[name]);
}

/** Value echoed back after a failed submit (React resets uncontrolled forms after an action). */
export function prev(state: ActionState<unknown>, name: string): string | undefined {
  return state.status === "error" ? state.values?.[name] : undefined;
}
