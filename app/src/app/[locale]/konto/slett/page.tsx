import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { requirePageUser } from "@/modules/auth/guards";
import { DeleteAccountForm } from "@/ui/forms/AuthForms";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("deleteHeading") };
}

export default async function DeleteAccountPage({ params }: PageProps<"/[locale]/konto/slett">) {
  const locale = await pageLocale(params);
  await requirePageUser(locale, "/konto/slett");
  const t = await getTranslations("account");
  return (
    <NarrowPage>
      <PageHeader title={t("deleteHeading")} lead={t("deleteLead")} />
      <div className="card p-6">
        <DeleteAccountForm locale={locale} />
      </div>
    </NarrowPage>
  );
}
