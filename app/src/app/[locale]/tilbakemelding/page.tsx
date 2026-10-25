import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale, param } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { FeedbackForm } from "@/ui/feedback/FeedbackForms";
import { PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("feedback");
  return { title: t("title"), robots: { index: false } };
}

/** «Gi tilbakemelding» (P04-01): errors, suggestions and anything else, straight to staff. */
export default async function FeedbackPage({ params, searchParams }: PageProps<"/[locale]/tilbakemelding">) {
  const locale = await pageLocale(params);
  await requirePageUser(locale, "/tilbakemelding");
  const thanks = param((await searchParams).takk) === "1";
  const t = await getTranslations("feedback");
  return (
    <div className="wrap flex max-w-2xl flex-col gap-6 py-10">
      <PageHeader title={t("title")} lead={t("lead")} />
      {thanks && (
        <Notice tone="success" role="status">
          {t("thanks")}
        </Notice>
      )}
      <section className="card p-6">
        <FeedbackForm locale={locale} />
      </section>
      <p className="fine-print">{t("privacy")}</p>
    </div>
  );
}
