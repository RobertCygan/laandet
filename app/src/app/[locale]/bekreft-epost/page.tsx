import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale, param } from "@/i18n/page";
import { ResendVerificationForm } from "@/ui/forms/AuthForms";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("checkEmailTitle") };
}

export default async function CheckEmailPage({ params, searchParams }: PageProps<"/[locale]/bekreft-epost">) {
  const locale = await pageLocale(params);
  const sent = param((await searchParams).sendt) === "1";
  const t = await getTranslations("auth");
  return (
    <NarrowPage>
      <PageHeader title={t("checkEmailTitle")} />
      {sent && (
        <div className="mb-6">
          <Notice tone="success" role="status">
            {t("checkEmailText")}
          </Notice>
        </div>
      )}
      <section className="card p-6">
        <h2 className="mb-4 text-xl">{t("resendTitle")}</h2>
        <ResendVerificationForm locale={locale} />
      </section>
    </NarrowPage>
  );
}
