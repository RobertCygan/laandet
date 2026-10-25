import type { Metadata } from "next";
import { pageLocale } from "@/i18n/page";
import { LegalDocument } from "@/ui/legal/LegalDocument";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/avtaler/utvidet-leieavtale">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? "Extended rental agreement" : "Utvidet leieavtale" };
}

export default async function RentalExtendedPage({ params }: PageProps<"/[locale]/avtaler/utvidet-leieavtale">) {
  return <LegalDocument docKey="rental_extended" locale={await pageLocale(params)} />;
}
