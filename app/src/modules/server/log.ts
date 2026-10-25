/**
 * Error logging without personal data (SEC-43). Database errors carry the failed query and its
 * parameters (which can hold emails, message text or tokens), and the driver adds `detail` with the
 * conflicting values. Only the error type, a cleaned message and the SQLSTATE code are logged.
 */
export function safeError(err: unknown): { name: string; message: string; code?: string } {
  if (!(err instanceof Error)) return { name: "NonError", message: "non-error thrown" };
  const cause = (err as { cause?: { code?: unknown; message?: unknown } }).cause;
  const code = typeof cause?.code === "string" ? cause.code : (err as { code?: unknown }).code;
  const message = err.message
    .replace(/\bparams:[\s\S]*$/i, "params: [redacted]")
    .replace(/Failed query:[\s\S]*?(params: \[redacted\]|$)/i, "Failed query: [redacted] $1")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    // A URL's query string can carry a token or a reset link (e.g. in a fetch or SMTP error).
    .replace(/(https?:\/\/[^\s?#]+)[?#]\S*/g, "$1?[redacted]")
    .slice(0, 300);
  return { name: err.name, message, ...(typeof code === "string" ? { code } : {}) };
}

/** `console.error` with a redacted error. */
export function logError(context: string, err: unknown): void {
  console.error(context, safeError(err));
}
