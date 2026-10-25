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
