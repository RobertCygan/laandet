import type { Metadata } from "next";
import { pageLocale } from "@/i18n/page";
import { LegalDocument } from "@/ui/legal/LegalDocument";

export async function generateMetadata({ params }: PageProps<"/[locale]/retningslinjer/trygg-utleie">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? "Safe rental" : "Trygg utleie" };
}

export default async function SafeRentalPage({ params }: PageProps<"/[locale]/retningslinjer/trygg-utleie">) {
  return <LegalDocument docKey="safe_rental" locale={await pageLocale(params)} />;
}
