"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteAccountAction,
  forgotPasswordAction,
  resendVerificationAction,
  resetPasswordAction,
  signInAction,
  signOutEverywhereAction,
  signUpAction,
  totpAction,
} from "@/modules/auth/actions";
import { idle } from "@/modules/server/action";
import { Link } from "@/i18n/navigation";
import { Notice } from "@/ui/Notice";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "./FormMessages";
import { PasswordField } from "./PasswordField";

type Loc = "nb" | "en";

export function SignUpForm({
  locale,
  localities,
  startedAt,
}: {
  locale: Loc;
  localities: { slug: string; name: string }[];
  startedAt: number;
}) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [state, action] = useActionState(signUpAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="startedAt" value={startedAt} />
      <div aria-hidden="true" className="visually-hidden">
        <label>
          {t("website")}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <label className="field">
        {t("name")}
        <span className="field-hint">{t("nameHint")}</span>
        <input
          name="name"
          autoComplete="nickname"
          required
          minLength={2}
          maxLength={40}
          defaultValue={prev(state, "name")}
          aria-invalid={invalid(state, "name")}
          aria-describedby="name-error"
        />
        <FieldError state={state} name="name" />
      </label>
      <label className="field">
        {t("email")}
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={prev(state, "email")}
          aria-invalid={invalid(state, "email")}
          aria-describedby="email-error"
        />
        <FieldError state={state} name="email" />
      </label>
      <PasswordField
        label={t("password")}
        hint={t("passwordHint")}
        name="password"
        autoComplete="new-password"
        state={state}
      />
      <label className="field">
        {t("localityOptional")}
        <select name="locality" defaultValue={prev(state, "locality") ?? ""} key={prev(state, "locality") ?? ""}>
          <option value="">{t("chooseLocality")}</option>
          {localities.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <label className="check">
          <input type="checkbox" name="age18" required defaultChecked={prev(state, "age18") === "on"} />
          <span>{t("age18")}</span>
        </label>
        <FieldError state={state} name="age18" />
        <label className="check">
          <input type="checkbox" name="privateUse" required defaultChecked={prev(state, "privateUse") === "on"} />
          <span>{t("privateUse")}</span>
        </label>
        <FieldError state={state} name="privateUse" />
        <label className="check">
          <input type="checkbox" name="terms" required defaultChecked={prev(state, "terms") === "on"} />
          <span>
            {t.rich("terms", {
              terms: (c) => (
                <Link href="/vilkar" className="text-link" target="_blank">
                  {c}
                </Link>
              ),
              privacy: (c) => (
                <Link href="/personvern" className="text-link" target="_blank">
                  {c}
                </Link>
              ),
            })}
          </span>
        </label>
        <FieldError state={state} name="terms" />
      </fieldset>
      <SubmitButton pendingLabel={tc("sending")}>{t("createButton")}</SubmitButton>
    </form>
  );
}

export function SignInForm({ locale, next }: { locale: Loc; next?: string }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [state, action] = useActionState(signInAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <label className="field">
        {t("email")}
        <input name="email" type="email" autoComplete="email" required defaultValue={prev(state, "email")} />
      </label>
      <PasswordField label={t("password")} name="password" autoComplete="current-password" />
      <SubmitButton pendingLabel={tc("sending")}>{t("signInButton")}</SubmitButton>
      {state.status === "error" && state.code === "email_unverified" && <ResendInline />}
    </form>
  );
}

function ResendInline() {
  const t = useTranslations("auth");
  return (
    <Link href="/bekreft-epost" className="text-link">
      {t("resendForMe")}
    </Link>
  );
}

export function TotpForm({ locale }: { locale: Loc }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(totpAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      <label className="field">
        {t("totpCode")}
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          aria-invalid={invalid(state, "code")}
        />
        <FieldError state={state} name="code" />
      </label>
      <SubmitButton>{t("totpButton")}</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm({ locale }: { locale: Loc }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(forgotPasswordAction, idle);
  if (state.status === "ok")
    return (
      <Notice tone="success" role="status">
        {t("forgotDone")}
      </Notice>
    );
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      <label className="field">
        {t("email")}
        <input name="email" type="email" autoComplete="email" required defaultValue={prev(state, "email")} />
        <FieldError state={state} name="email" />
      </label>
      <SubmitButton>{t("forgotButton")}</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(resetPasswordAction, idle);
  if (state.status === "ok")
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="success" role="status">
          {t("resetDone")}
        </Notice>
        <Link href="/logg-inn" className="button button-primary">
          {t("signInNow")}
        </Link>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      <input type="hidden" name="token" value={token} />
      <PasswordField
        label={t("newPassword")}
        hint={t("passwordHint")}
        name="password"
        autoComplete="new-password"
        state={state}
      />
      <SubmitButton>{t("resetButton")}</SubmitButton>
    </form>
  );
}

export function ResendVerificationForm({ locale, email }: { locale: Loc; email?: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(resendVerificationAction, idle);
  if (state.status === "ok")
    return (
      <Notice tone="success" role="status">
        {t("resendDone")}
      </Notice>
    );
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      <label className="field">
        {t("email")}
        <input name="email" type="email" autoComplete="email" defaultValue={prev(state, "email") ?? email} required />
      </label>
      <SubmitButton className="button button-outline">{t("resendButton")}</SubmitButton>
    </form>
  );
}

export function SignOutEverywhereForm({ locale }: { locale: Loc }) {
  const t = useTranslations("account");
  const [state, action] = useActionState(signOutEverywhereAction, idle);
  return (
    <form action={action}>
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      <SubmitButton className="button button-outline">{t("signOutEverywhere")}</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm({ locale }: { locale: Loc }) {
  const t = useTranslations("account");
  const [state, action] = useActionState(deleteAccountAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      <PasswordField label={t("deletePassword")} name="password" autoComplete="current-password" state={state} />
      <label className="check">
        <input type="checkbox" name="confirm" required />
        <span>{t("deleteConfirm")}</span>
      </label>
      <FieldError state={state} name="confirm" />
      <SubmitButton className="button button-danger">{t("deleteButton")}</SubmitButton>
    </form>
  );
}
