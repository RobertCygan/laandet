"use client";

import { Link, usePathname } from "@/i18n/navigation";

/** «Gi tilbakemelding» in the footer: carries the current page, since client navigation leaves no referrer. */
export function FeedbackLink({ label }: { label: string }) {
  const pathname = usePathname();
  return <Link href={`/tilbakemelding?fra=${encodeURIComponent(pathname)}`}>{label}</Link>;
}
