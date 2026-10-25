import type { Metadata } from "next";
import { pageLocale } from "@/i18n/page";
import { LegalDocument } from "@/ui/legal/LegalDocument";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/avtaler/forenklet-leieavtale">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? "Simplified rental agreement" : "Forenklet leieavtale" };
}

export default async function RentalSimplePage({ params }: PageProps<"/[locale]/avtaler/forenklet-leieavtale">) {
  return <LegalDocument docKey="rental_simple" locale={await pageLocale(params)} />;
}
