/**
 * Password length (AUTH_MODEL §1). The minimum is the owner's decision D-056 (6, below ASVS's 12); the
 * breached-password check, sign-in limits and staff 2FA stay. Kept apart so forms can import it without zod.
 */
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 128;
