import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, ShieldCheck, Star, MessageCircle } from "lucide-react";
import { demoOwners, demoListings } from "@/data/demoListings";
import { ListingCard } from "@/components/listings/ListingCard";
export const metadata: Metadata = {
  title: "Eksempelprofil",
  robots: { index: false, follow: false },
};
export function generateStaticParams() {
  return demoOwners.map((o) => ({ id: o.id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = demoOwners.find((o) => o.id === id);
  if (!owner) notFound();
  return (
    <div className="container profile-page">
      <div className="profile-header">
        <div className="profile-avatar">{owner.displayName.charAt(0)}</div>
        <span className="pill">Eksempelprofil</span>
        <h1>{owner.displayName}</h1>
        <p>
          <MapPin size={16} />
          {owner.location.localArea}, {owner.location.municipality}
        </p>
        <span className="muted">
          Medlem siden {owner.joinedYear} · fiktivt eksempel
        </span>
      </div>
      <div className="profile-planned">
        {[
          [ShieldCheck, "Verifisert med BankID"],
          [Star, "Vurderinger"],
          [MessageCircle, "Svarprosent"],
        ].map(([Icon, label]) => {
          const I = Icon as typeof Star;
          return (
            <div key={String(label)}>
              <I size={21} />
              <strong>{String(label)}</strong>
              <span>Kommer ved lansering</span>
            </div>
          );
        })}
      </div>
      <p className="research-banner">
        Dette er en fiktiv profil. Ingen identitet er verifisert, og ingen ekte
        transaksjoner eller omtaler finnes.
      </p>
      <section className="section">
        <h2>Eksempelannonser fra {owner.displayName}</h2>
        <div className="listing-grid">
          {demoListings
            .filter((l) => l.ownerDemoId === id)
            .map((l) => (
              <ListingCard listing={l} key={l.id} />
            ))}
        </div>
      </section>
    </div>
  );
}
