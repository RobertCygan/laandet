import { createHash } from "node:crypto";
import { isAPIError } from "better-auth/api";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { legalAcceptances, listings, localities, sessions, userProfiles, users } from "@/db/schema";
import { recordAudit } from "@/modules/audit/audit";
import { isFlagEnabled } from "@/modules/flags/flags";
import { currentLegalDoc } from "@/modules/legal/repo";
import { queueEmail } from "@/modules/notifications/outbox";
import { enforceRateLimits, LIMITS } from "@/modules/ratelimit/ratelimit";
import { getRequestMeta, hashIp } from "@/modules/server/request-meta";
import { AppError } from "@/modules/errors";
import type { UserActor } from "@/modules/authz/actor-types";
import { localePath } from "@/i18n/page";
import { auth } from "./auth";
import type { SignUpInput } from "./schemas";

const MIN_FILL_MS = 3000;

const lp = localePath;

/** Pseudonymous key for per-email rate limits and audit metadata (no raw emails stored). */
function emailKey(email: string): string {
  return createHash("sha256").update(`laandet:${email.toLowerCase()}`).digest("hex").slice(0, 32);
}

/**
 * Sign-up (AUTH_MODEL §1). Always returns the same outcome so the response does not
 * reveal whether the email already has an account (Better Auth emails the owner instead).
 */
export async function signUp(input: SignUpInput, now = Date.now()): Promise<void> {
  const meta = await getRequestMeta();
  if (input.website) throw new AppError("validation", "bot");
  if (now - input.startedAt < MIN_FILL_MS) throw new AppError("validation", "too_fast");
  if (!(await isFlagEnabled(db, "registrations_open"))) throw new AppError("feature_disabled");
  await enforceRateLimits(db, [{ bucket: `signup:ip:${hashIp(meta.ip) ?? "none"}`, rule: LIMITS.signUpPerIp }]);

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  try {
    await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
      headers: await headers(),
    });
  } catch (err) {
    if (isAPIError(err)) {
      const code = (err.body as { code?: string } | undefined)?.code;
      if (code === "PASSWORD_COMPROMISED") throw new AppError("validation", "password_compromised");
      if (code === "PASSWORD_TOO_SHORT") throw new AppError("validation", "password_too_short");
      throw new AppError("validation", "sign_up_failed");
    }
    throw err;
  }
  if (existing.length > 0) return; // existing account: Better Auth sent an informational email

  const [created] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  if (!created) throw new AppError("validation", "sign_up_failed");

  let localityId: string | null = null;
  if (input.locality) {
    const [loc] = await db.select({ id: localities.id }).from(localities).where(eq(localities.slug, input.locality));
    localityId = loc?.id ?? null;
  }
  const confirmedAt = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(userProfiles).values({
      userId: created.id,
      localityId,
      locale: input.locale,
      age18ConfirmedAt: confirmedAt,
      privateUseConfirmedAt: confirmedAt,
    });
    for (const key of ["terms", "privacy"] as const) {
      const doc = await currentLegalDoc(tx, key, "nb");
      if (doc) await tx.insert(legalAcceptances).values({ userId: created.id, documentVersionId: doc.id });
    }
    await recordAudit(tx, {
      actorId: created.id,
      actorRole: "user",
      action: "auth.sign_up",
      targetType: "user",
      targetId: created.id,
      meta,
    });
  });

  await auth.api.sendVerificationEmail({
    body: { email: input.email, callbackURL: lp(input.locale, "/konto?verified=1") },
  });
}

export type SignInResult = { twoFactor: boolean };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const meta = await getRequestMeta();
  const key = emailKey(email);
  await enforceRateLimits(db, [
    { bucket: `signin:email:${key}`, rule: LIMITS.signInPerEmail },
    { bucket: `signin:ip:${hashIp(meta.ip) ?? "none"}`, rule: LIMITS.signInPerIp },
  ]).catch(async (e) => {
    await recordAudit(db, { action: "auth.rate_limited", metadata: { emailKey: key, kind: "sign_in" }, meta });
    throw e;
  });
  try {
    const res = (await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    })) as { twoFactorRedirect?: boolean; user?: { id: string } };
    if (res.twoFactorRedirect) return { twoFactor: true };
    await recordAudit(db, { actorId: res.user?.id ?? null, action: "auth.sign_in", meta });
    return { twoFactor: false };
  } catch (err) {
    if (isAPIError(err)) {
      const code = (err.body as { code?: string } | undefined)?.code;
      await recordAudit(db, {
        action: "auth.sign_in_failed",
        metadata: { emailKey: key, code: code ?? "unknown" },
        meta,
      });
      // Only revealed after a correct password, so no account enumeration.
      if (code === "EMAIL_NOT_VERIFIED") throw new AppError("email_unverified");
      throw new AppError("validation", "invalid_credentials");
    }
    throw err;
  }
}

export async function verifyTotp(code: string): Promise<void> {
  const meta = await getRequestMeta();
  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
    await recordAudit(db, { action: "auth.two_factor_verified", meta });
  } catch (err) {
    if (isAPIError(err)) {
      await recordAudit(db, { action: "auth.two_factor_failed", meta });
      throw new AppError("validation", "totp_invalid");
    }
    throw err;
  }
}

export async function requestPasswordReset(email: string, locale: "nb" | "en"): Promise<void> {
  const meta = await getRequestMeta();
  await enforceRateLimits(db, [
    { bucket: `reset:email:${emailKey(email)}`, rule: LIMITS.emailPerAddress },
    { bucket: `reset:ip:${hashIp(meta.ip) ?? "none"}`, rule: LIMITS.signUpPerIp },
  ]);
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: lp(locale, "/nytt-passord") } });
  } catch (err) {
    // Same response whether or not the email exists.
    if (!isAPIError(err)) throw err;
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  try {
    await auth.api.resetPassword({ body: { token, newPassword } });
  } catch (err) {
    if (isAPIError(err)) {
      const code = (err.body as { code?: string } | undefined)?.code;
      if (code === "PASSWORD_COMPROMISED") throw new AppError("validation", "password_compromised");
      throw new AppError("validation", "reset_link_invalid");
    }
    throw err;
  }
}

export async function resendVerification(email: string, locale: "nb" | "en"): Promise<void> {
  const meta = await getRequestMeta();
  await enforceRateLimits(db, [
    { bucket: `verify:email:${emailKey(email)}`, rule: LIMITS.emailPerAddress },
    { bucket: `verify:ip:${hashIp(meta.ip) ?? "none"}`, rule: LIMITS.signUpPerIp },
  ]);
  const [u] = await db.select({ verified: users.emailVerified }).from(users).where(eq(users.email, email));
  if (!u || u.verified) return; // same response either way
  await auth.api.sendVerificationEmail({ body: { email, callbackURL: lp(locale, "/konto?verified=1") } });
}

export async function signOut(): Promise<void> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (err) {
    if (!isAPIError(err)) throw err;
  }
}

export async function signOutEverywhere(actor: UserActor): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, actor.id));
  await recordAudit(db, { actorId: actor.id, action: "auth.sign_out_everywhere", meta: await getRequestMeta() });
}

/** Re-authentication with the current password (AUTH_MODEL §1). */
export async function verifyCurrentPassword(password: string): Promise<boolean> {
  try {
    await auth.api.verifyPassword({ body: { password }, headers: await headers() });
    return true;
  } catch (err) {
    if (isAPIError(err)) return false;
    throw err;
  }
}

/**
 * «Slett konto»: deactivate now (status deletion_pending, listings hidden, sessions revoked).
 * Erasure itself runs later in the retention job (PRIVACY.md §6).
 */
export async function requestAccountDeletion(actor: UserActor, password: string): Promise<void> {
  if (!(await verifyCurrentPassword(password))) throw new AppError("validation", "wrong_password");
  const meta = await getRequestMeta();
  await db.transaction(async (tx) => {
    await tx
      .update(userProfiles)
      .set({
        status: "deletion_pending",
        deletionRequestedAt: new Date(),
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, actor.id));
    await tx
      .update(listings)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(
          eq(listings.ownerId, actor.id),
          inArray(listings.status, ["published", "paused", "draft"]),
          isNull(listings.deletedAt),
        ),
      );
    await queueEmail(tx, {
      toEmail: actor.email,
      toUserId: actor.id,
      template: "deletion_requested",
      locale: actor.locale,
      payload: { name: actor.name },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: "account.deletion_requested",
      targetType: "user",
      targetId: actor.id,
      meta,
    });
    await tx.delete(sessions).where(eq(sessions.userId, actor.id));
  });
}

const isStaff = (a: UserActor) => a.role === "moderator" || a.role === "admin";

/**
 * Staff 2FA setup, step 1 (AUTH_MODEL §2): re-authenticate with the password and create a TOTP secret.
 * The secret is shown once to the user and stored encrypted by Better Auth.
 */
export async function startTwoFactorSetup(
  actor: UserActor,
  password: string,
): Promise<{ totpURI: string; secret: string; backupCodes: string[] }> {
  if (!isStaff(actor)) throw new AppError("forbidden");
  if (actor.staff2fa) throw new AppError("conflict");
  try {
    const res = await auth.api.enableTwoFactor({ body: { password }, headers: await headers() });
    const totpURI = "totpURI" in res ? res.totpURI : "";
    const secret = new URL(totpURI).searchParams.get("secret") ?? "";
    return { totpURI, secret, backupCodes: "backupCodes" in res ? res.backupCodes : [] };
  } catch (err) {
    if (isAPIError(err)) throw new AppError("validation", "wrong_password");
    throw err;
  }
}

/** Staff 2FA setup, step 2: the first valid code turns 2FA on. */
export async function confirmTwoFactorSetup(actor: UserActor, code: string): Promise<void> {
  if (!isStaff(actor)) throw new AppError("forbidden");
  const meta = await getRequestMeta();
  try {
    await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
  } catch (err) {
    if (isAPIError(err)) throw new AppError("validation", "totp_invalid");
    throw err;
  }
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    action: "auth.two_factor_enabled",
    targetType: "user",
    targetId: actor.id,
    meta,
  });
}

/** «Endre passord»: current password required; other sessions are signed out (P01-07). */
export async function changePassword(actor: UserActor, currentPassword: string, newPassword: string): Promise<void> {
  const meta = await getRequestMeta();
  await enforceRateLimits(db, [{ bucket: `password-change:user:${actor.id}`, rule: LIMITS.signInPerEmail }]);
  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (err) {
    if (isAPIError(err)) {
      const code = (err.body as { code?: string } | undefined)?.code;
      if (code === "PASSWORD_COMPROMISED")
        throw new AppError("validation", "password_compromised", {
          fieldErrors: { newPassword: "password_compromised" },
        });
      if (code === "INVALID_PASSWORD")
        throw new AppError("validation", "wrong_password", { fieldErrors: { currentPassword: "wrong_password" } });
      throw new AppError("validation");
    }
    throw err;
  }
  await queueEmail(db, {
    toEmail: actor.email,
    toUserId: actor.id,
    template: "password_changed",
    locale: actor.locale,
    payload: { name: actor.name },
  });
  await recordAudit(db, {
    actorId: actor.id,
    action: "auth.password_changed",
    targetType: "user",
    targetId: actor.id,
    meta,
  });
}

/**
 * «Endre e-post»: re-authenticate, then a verification link goes to the new address. The old
 * address is told about the request. The response never reveals whether the address is taken.
 */
export async function changeEmail(
  actor: UserActor,
  password: string,
  newEmail: string,
  locale: "nb" | "en",
): Promise<void> {
  if (!(await verifyCurrentPassword(password)))
    throw new AppError("validation", "wrong_password", { fieldErrors: { password: "wrong_password" } });
  const meta = await getRequestMeta();
  await enforceRateLimits(db, [{ bucket: `email-change:user:${actor.id}`, rule: LIMITS.emailPerAddress }]);
  if (newEmail === actor.email) return;
  try {
    await auth.api.changeEmail({
      body: { newEmail, callbackURL: lp(locale, "/konto?epost=1") },
      headers: await headers(),
    });
  } catch (err) {
    if (!isAPIError(err)) throw err;
    throw new AppError("validation");
  }
  await queueEmail(db, {
    toEmail: actor.email,
    toUserId: actor.id,
    template: "email_change_requested",
    locale: actor.locale,
    payload: { name: actor.name },
  });
  await recordAudit(db, {
    actorId: actor.id,
    action: "auth.email_change_requested",
    targetType: "user",
    targetId: actor.id,
    meta,
  });
}
