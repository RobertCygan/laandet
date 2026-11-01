import type { Metadata } from "next";
import { pageLocale } from "@/i18n/page";
import { LegalDocument } from "@/ui/legal/LegalDocument";

export async function generateMetadata({ params }: PageProps<"/[locale]/retningslinjer/tvister">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? "When something goes wrong" : "Når noe går galt" };
}

export default async function DisputeGuidelinesPage({ params }: PageProps<"/[locale]/retningslinjer/tvister">) {
  return <LegalDocument docKey="dispute_guidelines" locale={await pageLocale(params)} />;
}
