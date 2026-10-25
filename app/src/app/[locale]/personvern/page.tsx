import type { Metadata } from "next";
import { pageLocale } from "@/i18n/page";
import { LegalDocument } from "@/ui/legal/LegalDocument";

export async function generateMetadata({ params }: PageProps<"/[locale]/personvern">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? "Privacy notice" : "Personvernerklæring" };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/personvern">) {
  return <LegalDocument docKey="privacy" locale={await pageLocale(params)} />;
}
