import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "./password-rules";

// Messages are i18n keys under `validation.*`.
export const emailSchema = z
  .email({ error: "email" })
  .max(254, { error: "email" })
  .transform((v) => v.trim().toLowerCase());
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, { error: "password_too_short" })
  .max(PASSWORD_MAX, { error: "password_too_long" });

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, { error: "name_length" })
  .max(40, { error: "name_length" })
  .refine((v) => !v.includes("@"), { error: "name_no_email" });

const checked = z.literal("on", { error: "must_confirm" });

export const signUpSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  locality: z
    .string()
    .max(60)
    .optional()
    .transform((v) => (v ? v : undefined)),
  age18: checked,
  privateUse: checked,
  terms: checked,
  locale: z.enum(["nb", "en"]),
  // Bot protection: honeypot must stay empty; form must not be submitted faster than 3 s.
  website: z.string().max(0, { error: "bot" }).optional().default(""),
  startedAt: z.coerce.number().int().positive(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "required" }).max(128),
  locale: z.enum(["nb", "en"]),
});

export const emailOnlySchema = z.object({ email: emailSchema, locale: z.enum(["nb", "en"]) });

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(500),
  password: passwordSchema,
});

export const totpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: "totp_format" }),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, { error: "required" }).max(128),
  confirm: checked,
});

export const twoFactorStartSchema = z.object({
  password: z.string().min(1, { error: "required" }).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { error: "required" }).max(128),
  newPassword: passwordSchema,
});

export const changeEmailSchema = z.object({
  password: z.string().min(1, { error: "required" }).max(128),
  newEmail: emailSchema,
  locale: z.enum(["nb", "en"]),
});
