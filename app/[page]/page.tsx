import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { infoSlugs, infoTitles } from "@/data/info";
export function generateStaticParams() {
  return infoSlugs.map((page) => ({ page }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  return { title: infoTitles[page] ?? "Siden finnes ikke" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  if (!infoSlugs.includes(page)) notFound();
  return <InfoPage page={page} />;
}
