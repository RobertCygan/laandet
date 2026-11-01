import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { env } from "@/modules/config/env";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("contactTitle") };
}

/** Operator details come from configuration only; nothing is invented (master spec §2). */
export default async function ContactPage({ params }: PageProps<"/[locale]/kontakt">) {
  await pageLocale(params);
  const t = await getTranslations("pages");
  const e = env();
  const complete = e.OPERATOR_LEGAL_NAME && e.OPERATOR_ORGNR && e.OPERATOR_ADDRESS && e.OPERATOR_EMAIL;
  // Production refuses to start without these (env.ts); elsewhere the gap is shown plainly.
  const missing = "MÅ FYLLES UT FØR LANSERING";
  return (
    <div className="wrap max-w-3xl py-10">
      <PageHeader title={t("contactTitle")} lead={t("contactLead")} />
      {complete || e.APP_ENV !== "production" ? (
        <section className="card p-6">
          <h2 className="mb-3 text-xl">{t("contactOperator")}</h2>
          <address className="flex flex-col gap-1 not-italic">
            <span className="font-bold">{e.OPERATOR_LEGAL_NAME ?? missing}</span>
            <span>Org.nr. {e.OPERATOR_ORGNR ?? missing}</span>
            <span>{e.OPERATOR_ADDRESS ?? missing}</span>
            {e.OPERATOR_EMAIL ? (
              <a href={`mailto:${e.OPERATOR_EMAIL}`} className="text-link">
                {e.OPERATOR_EMAIL}
              </a>
            ) : (
              <span>{missing}</span>
            )}
          </address>
          {!complete && (
            <div className="mt-4">
              <Notice tone="warning">{t("contactMissing")}</Notice>
            </div>
          )}
        </section>
      ) : (
        <Notice tone="warning">{t("contactMissing")}</Notice>
      )}
    </div>
  );
}
