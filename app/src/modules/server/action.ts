import { z } from "zod";
import { isAppError, type ErrorCode } from "@/modules/errors";
import { logError } from "./log";

/**
 * Uniform result for Server Actions used with `useActionState`.
 * `code` is an i18n key under `errors.*`; field errors are keys under `validation.*`.
 */
export type ActionState<T = void> =
  | { status: "idle" }
  | { status: "ok"; data?: T }
  | {
      status: "error";
      code: ErrorCode | "unexpected";
      detail?: string;
      fieldErrors?: Record<string, string>;
      /** Submitted values echoed back so the form can keep them after React resets it (never secrets). */
      values?: Record<string, string>;
    };

/** Initial state; assignable to any `ActionState<T>`. */
export const idle: { status: "idle" } = { status: "idle" };

export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    out[key] ??= issue.message;
  }
  return out;
}

const SECRET_FIELD = /pass|token|code|secret|website|startedAt/i;

/** Copy of the submitted values without passwords, tokens, codes or the honeypot. */
export function echoValues(raw: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(raw).filter(([k]) => !SECRET_FIELD.test(k)));
}

/**
 * Runs an action body and maps known errors; unexpected errors are logged without details leaking.
 * Pass `values` (the raw form) to have them echoed back on error.
 */
export async function runAction<T>(fn: () => Promise<T>, values?: Record<string, string>): Promise<ActionState<T>> {
  const echo = values ? { values: echoValues(values) } : {};
  try {
    const data = await fn();
    return { status: "ok", data };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { status: "error", code: "validation", fieldErrors: fieldErrors(err), ...echo };
    }
    if (isAppError(err)) {
      const fe = err.details?.fieldErrors as Record<string, string> | undefined;
      return {
        status: "error",
        code: err.code,
        detail: err.message !== err.code ? err.message : undefined,
        ...(fe ? { fieldErrors: fe } : {}),
        ...echo,
      };
    }
    // Next.js control flow (redirect/notFound) must propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    logError("[action] unexpected error", err);
    return { status: "error", code: "unexpected", ...echo };
  }
}
