import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageLocale } from "@/i18n/page";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("deletedTitle") };
}

export default async function AccountDeletedPage({ params }: PageProps<"/[locale]/konto/slettet">) {
  await pageLocale(params);
  const t = await getTranslations("account");
  const te = await getTranslations("errors");
  return (
    <NarrowPage>
      <PageHeader title={t("deletedTitle")} lead={t("deletedText")} />
      <Link href="/" className="button button-primary">
        {te("toFront")}
      </Link>
    </NarrowPage>
  );
}
