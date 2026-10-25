import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { ForgotPasswordForm } from "@/ui/forms/AuthForms";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgotTitle") };
}

export default async function ForgotPasswordPage({ params }: PageProps<"/[locale]/glemt-passord">) {
  const locale = await pageLocale(params);
  const t = await getTranslations("auth");
  return (
    <NarrowPage>
      <PageHeader title={t("forgotTitle")} lead={t("forgotLead")} />
      <div className="card p-6">
        <ForgotPasswordForm locale={locale} />
      </div>
    </NarrowPage>
  );
}
