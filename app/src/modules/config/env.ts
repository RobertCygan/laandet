import { z } from "zod";

/**
 * Validated environment. Import `env()` on the server only.
 * The app refuses to start with missing or invalid values (P01-01).
 */
const secret = (name: string) =>
  z.string().min(32, `${name} must be at least 32 characters`);

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const envSchema = z
  .object({
    APP_ENV: z.enum(["development", "test", "staging", "production"]),
    APP_URL: z.url(),
    DATABASE_URL: z.string().startsWith("postgres"),
    DATABASE_MIGRATION_URL: z.string().startsWith("postgres").optional(),
    BETTER_AUTH_SECRET: secret("BETTER_AUTH_SECRET"),
    IP_HASH_KEY: secret("IP_HASH_KEY"),
    MEDIA_DIR: z.string().min(1),
    SMTP_URL: optionalText,
    MAIL_FROM: z.string().min(3).default("Laandet <noreply@example.invalid>"),
    HIBP_ENABLED: z.stringbool().optional(),
    OPERATOR_LEGAL_NAME: optionalText,
    OPERATOR_ORGNR: optionalText,
    OPERATOR_ADDRESS: optionalText,
    OPERATOR_EMAIL: optionalText,
    SUPPORT_CAMPAIGN_URL: optionalText.pipe(z.url().optional()),
    SUPPORT_PROVIDER_NAME: optionalText,
    SUPPORT_FEE_TEXT: optionalText,
    SUPPORT_RECIPIENT_NAME: optionalText,
    SUPPORT_RECIPIENT_ORGNR: optionalText,
  })
  .superRefine((e, ctx) => {
    if (e.APP_ENV === "production") {
      for (const key of [
        "OPERATOR_LEGAL_NAME",
        "OPERATOR_ORGNR",
        "OPERATOR_ADDRESS",
        "OPERATOR_EMAIL",
        "SMTP_URL",
      ] as const) {
        if (!e[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
        }
      }
      if (!e.APP_URL.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "APP_URL must use https in production" });
      }
    }
    if (e.SUPPORT_CAMPAIGN_URL) {
      for (const key of [
        "SUPPORT_PROVIDER_NAME",
        "SUPPORT_FEE_TEXT",
        "SUPPORT_RECIPIENT_NAME",
        "SUPPORT_RECIPIENT_ORGNR",
      ] as const) {
        if (!e[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when SUPPORT_CAMPAIGN_URL is set`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

// `next build` evaluates server modules without runtime secrets (e.g. in a Docker build).
// Placeholders are used ONLY in that phase; at runtime every value is validated.
const BUILD_PHASE_DEFAULTS: Record<string, string> = {
  APP_ENV: "production",
  APP_URL: "https://build.invalid",
  DATABASE_URL: "postgres://build@localhost/build",
  BETTER_AUTH_SECRET: "build-phase-placeholder-not-a-secret-000",
  IP_HASH_KEY: "build-phase-placeholder-not-a-secret-000",
  MEDIA_DIR: "/tmp",
  SMTP_URL: "smtp://build.invalid",
  OPERATOR_LEGAL_NAME: "build",
  OPERATOR_ORGNR: "build",
  OPERATOR_ADDRESS: "build",
  OPERATOR_EMAIL: "build",
};

export function env(): Env {
  if (cached) return cached;
  const source =
    process.env.NEXT_PHASE === "phase-production-build"
      ? { ...BUILD_PHASE_DEFAULTS, ...process.env }
      : process.env;
  cached = parseEnv(source);
  return cached;
}

/** HIBP is on by default outside development and test. */
export function hibpEnabled(e: Env = env()): boolean {
  return e.HIBP_ENABLED ?? (e.APP_ENV === "staging" || e.APP_ENV === "production");
}
