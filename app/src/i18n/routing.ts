import { defineRouting } from "next-intl/routing";

// nb is the default and has no URL prefix; English lives under /en.
// Locale routing is done in src/proxy.ts (no locale cookie, no auto-detection).
export const routing = defineRouting({
  locales: ["nb", "en"],
  defaultLocale: "nb",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: unknown): value is Locale {
  return value === "nb" || value === "en";
}
