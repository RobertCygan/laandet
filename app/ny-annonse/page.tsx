import type { Metadata } from "next";
import { ListingWizard } from "@/components/forms/ListingWizard";
export const metadata: Metadata = {
  title: "Lei ut tingene du allerede har",
  description:
    "Prøv å lage en annonse eller legg ut hva du ønsker å leie. Lokal forhåndsvisning i testversjonen av Lånndet.",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  return <ListingWizard initialType={type ?? "rental"} />;
}
