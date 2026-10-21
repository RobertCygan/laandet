"use client";
import Link from "next/link";
import Image from "next/image";
import { Heart, MapPin, Truck, ArrowUpRight, CalendarDays } from "lucide-react";
import type { Listing, WantedListing } from "@/types";
import { categoryName } from "@/data/categories";
import { nok } from "@/lib/config";
import { useResearch } from "@/components/research/ResearchProvider";
import { track } from "@/lib/research";
export function ListingCard({
  listing,
  priority = false,
}: {
  listing: Listing;
  priority?: boolean;
}) {
  const { favorites, toggleFavorite } = useResearch();
  const price =
    listing.priceDay ??
    listing.priceWeekend ??
    listing.priceWeek ??
    listing.priceHour ??
    0;
  const unit = listing.priceDay
    ? "dag"
    : listing.priceWeekend
      ? "helg"
      : listing.priceWeek
        ? "uke"
        : "time";
  const saved = favorites.includes(listing.id);
  return (
    <article className="listing-card" data-testid="listing-card">
      <div className="listing-image">
        <Link
          href={`/annonse/${listing.id}`}
          aria-label={`Se ${listing.title}`}
          tabIndex={-1}
        >
          <Image
            src={`/images/equipment-${listing.imageIndex + 1}.webp`}
            alt={`${listing.title} – generert eksempelbilde`}
            fill
            sizes="(max-width: 600px) 46vw, (max-width: 1000px) 45vw, 25vw"
            className="product-image"
            priority={priority}
          />
        </Link>
        <span className="demo-badge">Demoannonse</span>
        <button
          className={`favorite ${saved ? "is-favorite" : ""}`}
          aria-label={`${saved ? "Fjern" : "Lagre"} ${listing.title} ${saved ? "fra" : "som"} favoritt`}
          aria-pressed={saved}
          onClick={() => toggleFavorite(listing.id)}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
        {listing.deliveryAvailable && (
          <span className="delivery-badge">
            <Truck size={12} />
            Kan leveres +
          </span>
        )}
      </div>
      <div className="listing-content">
        <span className="category-label">{categoryName(listing.category)}</span>
        <h3>
          <Link href={`/annonse/${listing.id}`}>{listing.title}</Link>
        </h3>
        <p className="listing-location">
          <MapPin size={13} />
          {listing.location}, Steigen
        </p>
        <div className="listing-bottom">
          <p className="price">
            <strong>
              {listing.id === "hoytrykksspyler" ? "fra " : ""}
              {nok(price)} kr
            </strong>
            <span>/ {unit}</span>
          </p>
          <ArrowUpRight size={19} aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}
export function WantedCard({ listing }: { listing: WantedListing }) {
  const { open } = useResearch();
  return (
    <article className="wanted-card" data-testid="wanted-card">
      <div className="wanted-top">
        <span className="wanted-badge">Ønskes leid</span>
        <span className="demo-text">Demoannonse</span>
      </div>
      <span className="category-label">{categoryName(listing.category)}</span>
      <h3>
        <Link href={`/annonse/${listing.id}`}>{listing.title}</Link>
      </h3>
      <p className="listing-location">
        <MapPin size={13} />
        {listing.location}, Steigen
      </p>
      <p className="wanted-period">
        <CalendarDays size={15} />
        {listing.period}
      </p>
      <p className="wanted-budget">{listing.budget}</p>
      <button
        className="button outline full-width"
        onClick={() => {
          track("wanted_listing_opened", {
            listingId: listing.id,
            category: listing.category,
            location: listing.location,
          });
          open({ type: "intent", owner: true, source: listing.id });
        }}
      >
        Jeg har dette <ArrowUpRight size={16} />
      </button>
    </article>
  );
}
