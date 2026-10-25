"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  changeEmailAction,
  changePasswordAction,
  confirmTwoFactorAction,
  startTwoFactorAction,
} from "@/modules/auth/actions";
import { idle } from "@/modules/server/action";
import { updateProfileAction } from "@/modules/users/actions";
import { Notice } from "@/ui/Notice";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "./FormMessages";
import { PasswordField } from "./PasswordField";

type Profile = {
  name: string;
  bio: string | null;
  localitySlug: string | null;
  locale: "nb" | "en";
  emailNotifications: boolean;
};

export function ProfileForm({
  profile,
  localities,
}: {
  profile: Profile;
  localities: { slug: string; name: string }[];
}) {
  const t = useTranslations("account");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const [state, action] = useActionState(updateProfileAction, idle);
  const v = (name: string, fallback: string) => prev(state, name) ?? fallback;
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      {state.status === "ok" && (
        <Notice tone="success" role="status">
          {t("saved")}
        </Notice>
      )}
      <label className="field">
        {ta("name")}
        <span className="field-hint">{ta("nameHint")}</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={40}
          defaultValue={v("name", profile.name)}
          aria-invalid={invalid(state, "name")}
        />
        <FieldError state={state} name="name" />
      </label>
      <label className="field">
        {ta("localityOptional")}
        <select name="locality" defaultValue={v("locality", profile.localitySlug ?? "")}>
          <option value="">{ta("chooseLocality")}</option>
          {localities.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {t("bio")}
        <span className="field-hint">{t("bioHint")}</span>
        <textarea
          name="bio"
          rows={4}
          maxLength={500}
          defaultValue={v("bio", profile.bio ?? "")}
          aria-invalid={invalid(state, "bio")}
        />
        <FieldError state={state} name="bio" />
      </label>
      <label className="field">
        {t("language")}
        <select name="locale" defaultValue={v("locale", profile.locale)}>
          <option value="nb">Norsk (bokmål)</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="emailNotifications"
          defaultChecked={
            state.status === "error" ? prev(state, "emailNotifications") === "on" : profile.emailNotifications
          }
        />
        <span>{t("emailNotifications")}</span>
      </label>
      <SubmitButton pendingLabel={tc("saving")}>{tc("save")}</SubmitButton>
    </form>
  );
}

/** Staff 2FA setup: password → key + backup codes (shown once) → confirm with a code. */
export function TwoFactorSetup() {
  const t = useTranslations("admin");
  const ta = useTranslations("auth");
  const [start, startAction] = useActionState(startTwoFactorAction, idle);
  const [confirm, confirmAction] = useActionState(confirmTwoFactorAction, idle);

  if (confirm.status === "ok") {
    return (
      <Notice tone="success" role="status">
        {t("setup2faDone")}
      </Notice>
    );
  }
  if (start.status !== "ok" || !start.data) {
    return (
      <form action={startAction} className="flex flex-col gap-5">
        <FormError state={start} />
        <PasswordField label={ta("password")} name="password" autoComplete="current-password" state={start} />
        <SubmitButton>{t("setup2faStart")}</SubmitButton>
      </form>
    );
  }
  const { secret, totpURI, backupCodes } = start.data;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2">{t("setup2faUri")}</p>
        <code className="block rounded-md bg-surface p-3 text-lg break-all select-all">
          {secret.replace(/(.{4})/g, "$1 ").trim()}
        </code>
        <a href={totpURI} className="text-link mt-2 inline-block">
          otpauth://…
        </a>
      </div>
      <div>
        <p className="mb-2">{t("setup2faBackup")}</p>
        <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
          {backupCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      <form action={confirmAction} className="flex flex-col gap-5">
        <FormError state={confirm} />
        <label className="field">
          {ta("totpCode")}
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            aria-invalid={invalid(confirm, "code")}
          />
          <FieldError state={confirm} name="code" />
        </label>
        <SubmitButton>{t("setup2faVerify")}</SubmitButton>
      </form>
    </div>
  );
}

export function ChangePasswordForm() {
  const t = useTranslations("account");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const [state, action] = useActionState(changePasswordAction, idle);
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      {state.status === "ok" && (
        <Notice tone="success" role="status">
          {t("passwordChanged")}
        </Notice>
      )}
      <PasswordField
        label={t("currentPassword")}
        name="currentPassword"
        autoComplete="current-password"
        state={state}
      />
      <PasswordField
        label={ta("newPassword")}
        hint={ta("passwordHint")}
        name="newPassword"
        autoComplete="new-password"
        state={state}
      />
      <SubmitButton className="button button-outline" pendingLabel={tc("saving")}>
        {t("changePasswordButton")}
      </SubmitButton>
    </form>
  );
}

export function ChangeEmailForm({ locale }: { locale: "nb" | "en" }) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [state, action] = useActionState(changeEmailAction, idle);
  if (state.status === "ok") {
    return (
      <Notice tone="success" role="status">
        {t("emailChangeSent")}
      </Notice>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormError state={state} />
      <input type="hidden" name="locale" value={locale} />
      <label className="field">
        {t("newEmail")}
        <span className="field-hint">{t("changeEmailHint")}</span>
        <input
          name="newEmail"
          type="email"
          autoComplete="email"
          required
          defaultValue={prev(state, "newEmail")}
          aria-invalid={invalid(state, "newEmail")}
        />
        <FieldError state={state} name="newEmail" />
      </label>
      <PasswordField label={t("currentPassword")} name="password" autoComplete="current-password" state={state} />
      <SubmitButton className="button button-outline" pendingLabel={tc("sending")}>
        {t("changeEmailButton")}
      </SubmitButton>
    </form>
  );
}
