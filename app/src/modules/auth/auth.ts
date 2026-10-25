import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { twoFactor } from "better-auth/plugins/two-factor";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, rateLimits, sessions, twoFactors, userProfiles, users, verifications } from "@/db/schema";
import { env, hibpEnabled } from "@/modules/config/env";
import { queueEmail } from "@/modules/notifications/outbox";

const DAY = 24 * 60 * 60;

/** Language for emails: the user's profile setting, default Norwegian. */
async function localeOf(userId: string): Promise<"nb" | "en"> {
  const [p] = await db
    .select({ locale: userProfiles.locale, status: userProfiles.status })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));
  return p?.locale ?? "nb";
}

function localePath(locale: "nb" | "en", path: string): string {
  return `${locale === "en" ? "/en" : ""}${path}`;
}

const e = env();

export const auth = betterAuth({
  appName: "Laandet",
  baseURL: e.APP_URL,
  secret: e.BETTER_AUTH_SECRET,
  trustedOrigins: [e.APP_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      twoFactor: twoFactors,
      rateLimit: rateLimits,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    async sendResetPassword({ user, url }) {
      await queueEmail(db, {
        toEmail: user.email,
        toUserId: user.id,
        template: "reset_password",
        locale: await localeOf(user.id),
        payload: { name: user.name, url },
      });
    },
    async onPasswordReset({ user }) {
      await queueEmail(db, {
        toEmail: user.email,
        toUserId: user.id,
        template: "password_changed",
        locale: await localeOf(user.id),
        payload: { name: user.name },
      });
    },
    async onExistingUserSignUp({ user }) {
      const locale = await localeOf(user.id);
      await queueEmail(db, {
        toEmail: user.email,
        toUserId: user.id,
        template: "existing_account_signup",
        locale,
        payload: { name: user.name, url: `${e.APP_URL}${localePath(locale, "/glemt-passord")}` },
      });
    },
  },
  emailVerification: {
    // Sent explicitly by the sign-up service after the profile row exists.
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    expiresIn: DAY,
    async sendVerificationEmail({ user, url }) {
      await queueEmail(db, {
        toEmail: user.email,
        toUserId: user.id,
        template: "verify_email",
        locale: await localeOf(user.id),
        payload: { name: user.name, url },
      });
    },
  },
  // The new address must be verified before the change takes effect (P01-07).
  user: { changeEmail: { enabled: true } },
  session: {
    expiresIn: 30 * DAY,
    updateAge: DAY,
  },
  rateLimit: {
    enabled: e.APP_ENV !== "test",
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 15 * 60, max: 20 },
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/send-verification-email": { window: 60 * 60, max: 5 },
      "/two-factor/verify-totp": { window: 15 * 60, max: 10 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Deleted accounts can never get a session (SEC-12).
        async before(session) {
          const [p] = await db
            .select({ status: userProfiles.status })
            .from(userProfiles)
            .where(eq(userProfiles.userId, session.userId));
          if (p?.status === "deleted") return false;
        },
      },
    },
  },
  advanced: {
    database: { generateId: "uuid" },
    useSecureCookies: true,
    cookiePrefix: "laandet",
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/", httpOnly: true },
    cookies: {
      session_token: { name: "__Host-laandet.session" },
      session_data: { name: "__Host-laandet.session_data" },
      dont_remember: { name: "__Host-laandet.dont_remember" },
    },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },
  plugins: [
    twoFactor({ issuer: "Laandet", twoFactorCookieMaxAge: 10 * 60 }),
    ...(hibpEnabled(e) ? [haveIBeenPwned()] : []),
    // Must be last: lets Server Actions set auth cookies.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
