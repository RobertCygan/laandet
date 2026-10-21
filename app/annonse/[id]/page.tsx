import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demoListings, demoWanted } from "@/data/demoListings";
import { ListingDetail } from "@/components/listings/ListingDetail";
const all = [...demoListings, ...demoWanted];
export function generateStaticParams() {
  return all.map((l) => ({ id: l.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = all.find((l) => l.id === id);
  return {
    title: listing
      ? `${listing.title} i ${listing.location} – demo`
      : "Annonsen finnes ikke",
    description: listing?.description,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = all.find((l) => l.id === id);
  if (!listing) notFound();
  return <ListingDetail listing={listing} />;
}
