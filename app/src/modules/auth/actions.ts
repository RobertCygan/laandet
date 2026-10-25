"use server";

import { redirect } from "next/navigation";
import { requireUser } from "./actor";
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  emailOnlySchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  totpSchema,
  twoFactorStartSchema,
} from "./schemas";
import * as service from "./service";
import { localePath } from "@/i18n/page";
import { formToObject, runAction, type ActionState } from "@/modules/server/action";

const lp = localePath;

/** Only same-site relative paths are accepted as a post-login target (no open redirects). */
function safeNext(value: string | undefined, locale: string): string {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  return lp(locale, "/konto");
}

export async function signUpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const input = signUpSchema.parse(raw);
    await service.signUp(input);
  }, raw);
  if (result.status === "ok") redirect(lp(raw.locale ?? "nb", "/bekreft-epost?sendt=1"));
  return result;
}

export async function signInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  let twoFactor = false;
  const result = await runAction(async () => {
    const input = signInSchema.parse(raw);
    twoFactor = (await service.signIn(input.email, input.password)).twoFactor;
  }, raw);
  if (result.status !== "ok") return result;
  if (twoFactor) redirect(lp(raw.locale ?? "nb", "/logg-inn/totp"));
  redirect(safeNext(raw.next, raw.locale ?? "nb"));
}

export async function totpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const { code } = totpSchema.parse(raw);
    await service.verifyTotp(code);
  });
  if (result.status === "ok") redirect(lp(raw.locale ?? "nb", "/admin"));
  return result;
}

export async function forgotPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  return runAction(async () => {
    const { email, locale } = emailOnlySchema.parse(raw);
    await service.requestPasswordReset(email, locale);
  }, raw);
}

export async function resetPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { token, password } = resetPasswordSchema.parse(formToObject(form));
    await service.resetPassword(token, password);
  });
}

export async function resendVerificationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  return runAction(async () => {
    const { email, locale } = emailOnlySchema.parse(raw);
    await service.resendVerification(email, locale);
  }, raw);
}

export async function signOutAction(form: FormData): Promise<void> {
  await service.signOut();
  redirect(lp(String(form.get("locale") ?? "nb"), "/"));
}

export async function signOutEverywhereAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const actor = await requireUser();
    await service.signOutEverywhere(actor);
  });
  if (result.status === "ok") redirect(lp(String(form.get("locale") ?? "nb"), "/logg-inn"));
  return result;
}

export async function deleteAccountAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  const result = await runAction(async () => {
    const actor = await requireUser();
    const { password } = deleteAccountSchema.parse(raw);
    await service.requestAccountDeletion(actor, password);
  });
  if (result.status === "ok") redirect(lp(raw.locale ?? "nb", "/konto/slettet"));
  return result;
}

export type TwoFactorSetup = { totpURI: string; secret: string; backupCodes: string[] };

export async function startTwoFactorAction(_prev: ActionState<TwoFactorSetup>, form: FormData): Promise<ActionState<TwoFactorSetup>> {
  return runAction(async () => {
    const actor = await requireUser();
    const { password } = twoFactorStartSchema.parse(formToObject(form));
    return service.startTwoFactorSetup(actor, password);
  });
}

export async function confirmTwoFactorAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const { code } = totpSchema.parse(formToObject(form));
    await service.confirmTwoFactorSetup(actor, code);
  });
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    const { currentPassword, newPassword } = changePasswordSchema.parse(formToObject(form));
    await service.changePassword(actor, currentPassword, newPassword);
  });
}

export async function changeEmailAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  return runAction(async () => {
    const actor = await requireUser();
    const { password, newEmail, locale } = changeEmailSchema.parse(raw);
    await service.changeEmail(actor, password, newEmail, locale);
  }, raw);
}
