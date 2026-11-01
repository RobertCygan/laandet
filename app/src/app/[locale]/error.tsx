"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Generic error page (SEC-42): no stack trace, no message from the server — only a reference code
 * (the error digest) that matches the server log, so support can find the error without personal data.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  return (
    <div className="wrap flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <h1>{t("errorTitle")}</h1>
      <p>{t("errorText")}</p>
      {error.digest && (
        <p className="fine-print">
          {t("errorReference")}: <code>{error.digest}</code>
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="button button-primary" onClick={() => reset()}>
          {t("tryAgain")}
        </button>
        <Link href="/" className="button button-outline">
          {t("toFront")}
        </Link>
      </div>
    </div>
  );
}
