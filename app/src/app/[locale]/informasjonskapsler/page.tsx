import type { Metadata } from "next";
import { pageLocale } from "@/i18n/page";
import { LegalDocument } from "@/ui/legal/LegalDocument";

export async function generateMetadata({ params }: PageProps<"/[locale]/informasjonskapsler">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? "Cookies" : "Informasjonskapsler" };
}

export default async function CookiesPage({ params }: PageProps<"/[locale]/informasjonskapsler">) {
  return <LegalDocument docKey="cookies" locale={await pageLocale(params)} />;
}
