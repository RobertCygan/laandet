"use client";

import { Globe } from "lucide-react";
import { usePathname } from "next/navigation";

/** Links to the same page in the other language (nb has no prefix, en lives under /en). */
export function LanguageSwitch({ locale, label }: { locale: "nb" | "en"; label: string }) {
  const pathname = usePathname() || "/";
  const target =
    locale === "en" ? pathname.replace(/^\/en(?=\/|$)/, "") || "/" : `/en${pathname === "/" ? "" : pathname}`;
  return (
    <a
      href={target}
      hrefLang={locale === "en" ? "nb" : "en"}
      lang={locale === "en" ? "nb" : "en"}
      className="inline-flex min-h-11 items-center gap-1.5 font-semibold"
    >
      <Globe size={16} aria-hidden="true" />
      {label}
    </a>
  );
}
