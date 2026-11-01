import type { Metadata } from "next";
import { pageLocale } from "@/i18n/page";
import { LegalDocument } from "@/ui/legal/LegalDocument";

export async function generateMetadata({ params }: PageProps<"/[locale]/vilkar">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? "Terms of use" : "Brukervilkår" };
}

export default async function TermsPage({ params }: PageProps<"/[locale]/vilkar">) {
  return <LegalDocument docKey="terms" locale={await pageLocale(params)} />;
}
