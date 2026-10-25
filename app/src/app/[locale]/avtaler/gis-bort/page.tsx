import type { Metadata } from "next";
import { pageLocale } from "@/i18n/page";
import { LegalDocument } from "@/ui/legal/LegalDocument";

export async function generateMetadata({ params }: PageProps<"/[locale]/avtaler/gis-bort">): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "en" ? "Give-away confirmation" : "Gis bort – bekreftelse" };
}

export default async function GiveawayTransferPage({ params }: PageProps<"/[locale]/avtaler/gis-bort">) {
  return <LegalDocument docKey="giveaway_transfer" locale={await pageLocale(params)} />;
}
