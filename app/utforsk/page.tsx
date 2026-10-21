import type { Metadata } from "next";
import { Explore } from "@/components/listings/Explore";
export const metadata: Metadata = {
  title: "Lei verktøy og utstyr i Steigen",
  description:
    "Utforsk demoannonser for lokal utleie og ønsker i Steigen. Filtrer etter kategori, område, pris og levering.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const initial = Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  return <Explore key={JSON.stringify(initial)} initial={initial} />;
}
