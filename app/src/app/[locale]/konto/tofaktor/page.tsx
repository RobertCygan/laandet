import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { TwoFactorSetup } from "@/ui/forms/AccountForms";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("setup2faTitle") };
}

export default async function TwoFactorPage({ params }: PageProps<"/[locale]/konto/tofaktor">) {
  const locale = await pageLocale(params);
  const actor = await requirePageUser(locale, "/konto/tofaktor");
  // Only staff need (and may set up) 2FA in the MVP (AUTH_MODEL §2).
  if (actor.role !== "moderator" && actor.role !== "admin") notFound();
  const t = await getTranslations("admin");
  return (
    <NarrowPage>
      <PageHeader title={t("setup2faTitle")} lead={actor.staff2fa ? undefined : t("setup2faLead")} />
      <div className="card p-6">{actor.staff2fa ? <Notice tone="success">{t("setup2faDone")}</Notice> : <TwoFactorSetup />}</div>
    </NarrowPage>
  );
}
