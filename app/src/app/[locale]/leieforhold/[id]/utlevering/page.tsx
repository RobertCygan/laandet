import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageLocale, param } from "@/i18n/page";
import { ConditionReportPage } from "@/ui/rentals/ConditionReport";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("condition");
  return { title: t("handoverTitle"), robots: { index: false } };
}

export default async function HandoverPage({
  params,
  searchParams,
}: PageProps<"/[locale]/leieforhold/[id]/utlevering">) {
  const locale = await pageLocale(params);
  const { id } = await params;
  const ok = param((await searchParams).ok);
  return <ConditionReportPage locale={locale} bookingId={id} phase="handover" ok={ok} />;
}
