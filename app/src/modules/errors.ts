/** Typed domain errors. Actions map them to localised messages (errors.<code>). */
export type ErrorCode =
  | "auth_required"
  | "email_unverified"
  | "account_restricted"
  | "forbidden"
  | "not_found"
  | "validation"
  | "rate_limited"
  | "conflict"
  | "feature_disabled"
  | "staff_2fa_required"
  | "staff_session_expired";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}

export const notFound = () => new AppError("not_found");
export const forbidden = (code: ErrorCode = "forbidden") => new AppError(code);

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
