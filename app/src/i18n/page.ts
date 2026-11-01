import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "./routing";

/** Resolve and register the locale for a page (invalid values fall back to nb; the layout 404s them). */
export async function pageLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "nb";
  setRequestLocale(l);
  return l;
}

/** Locale-prefixed path: nb has no prefix, English lives under /en. */
export function localePath(locale: string, path: string): string {
  return `${locale === "en" ? "/en" : ""}${path}`;
}

/** First value of a search param. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * A same-site path that is safe to redirect to after sign-in (no open redirects): it must start with a
 * single "/", and may not contain backslashes, whitespace or control characters (browsers strip tabs and
 * newlines, which would turn "/\t/evil.example" into "//evil.example").
 */
export function safeRedirectPath(value: string | undefined | null): string | undefined {
  if (!value || value.length > 512) return undefined;
  return /^\/(?![/\\])[^\s\\\u0000-\u001f\u007f]*$/.test(value) ? value : undefined;
}
