import type { Metadata } from "next";
import { pageLocale } from "@/i18n/page";
import { LegalDocument } from "@/ui/legal/LegalDocument";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/retningslinjer/forbudte-gjenstander">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? "Prohibited and restricted items" : "Forbudte og begrensede gjenstander" };
}

export default async function ProhibitedItemsPage({
  params,
}: PageProps<"/[locale]/retningslinjer/forbudte-gjenstander">) {
  return <LegalDocument docKey="prohibited_items" locale={await pageLocale(params)} />;
}
