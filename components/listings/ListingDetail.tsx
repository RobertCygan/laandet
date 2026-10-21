"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Heart,
  MapPin,
  Truck,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ShieldCheck,
  Share2,
  ZoomIn,
  X,
} from "lucide-react";
import type { Listing, WantedListing, PriceUnit } from "@/types";
import { demoListings, demoOwners } from "@/data/demoListings";
import { categoryName } from "@/data/categories";
import { useResearch } from "@/components/research/ResearchProvider";
import { track } from "@/lib/research";
import { nok, units, RESEARCH_MODE } from "@/lib/config";
import { ListingCard } from "./ListingCard";
export function ListingDetail({
  listing,
}: {
  listing: Listing | WantedListing;
}) {
  const { open, favorites, toggleFavorite } = useResearch();
  const [delivery, setDelivery] = useState(false);
  const [share, setShare] = useState("");
  const [lightbox, setLightbox] = useState(false);
  const [unit, setUnit] = useState<PriceUnit>("day");
  const seen = useRef("");
  const dialog = useRef<HTMLDialogElement>(null);
  const owner = demoOwners.find((o) => o.id === listing.ownerDemoId)!;
  useEffect(() => {
    if (seen.current !== listing.id) {
      track(
        listing.listingType === "wanted"
          ? "wanted_listing_opened"
          : "listing_opened",
        {
          listingId: listing.id,
          category: listing.category,
          location: listing.location,
        },
      );
      seen.current = listing.id;
    }
  }, [listing]);
  useEffect(() => {
    if (lightbox) dialog.current?.showModal();
    else dialog.current?.close();
  }, [lightbox]);
  const rental = listing.listingType === "rental" ? listing : null;
  const prices = rental
    ? Object.entries({
        hour: rental.priceHour,
        day: rental.priceDay,
        weekend: rental.priceWeekend,
        week: rental.priceWeek,
      }).filter((x): x is [PriceUnit, number] => x[1] !== undefined)
    : [];
  const selectedPrice = prices.find(([u]) => u === unit) ?? prices[0];
  function intent() {
    if (!RESEARCH_MODE) return;
    track(
      listing.listingType === "wanted"
        ? "have_this_clicked"
        : "rent_cta_clicked",
      {
        listingId: listing.id,
        category: listing.category,
        location: listing.location,
        stage: "opened",
        delivery,
        price: selectedPrice?.[1] ?? 0,
      },
    );
    open({
      type: "intent",
      owner: listing.listingType === "wanted",
      source: listing.id,
    });
  }
  return (
    <div className="container detail-page">
      <div className="breadcrumb">
        <Link href="/utforsk">
          <ArrowLeft size={14} />
          Alle annonser
        </Link>
        <span>/</span>
        <span>{categoryName(listing.category)}</span>
      </div>
      <div className="detail-heading">
        <div>
          <span className="demo-badge static">Demoannonse</span>
          <h1>{listing.title}</h1>
          <p className="listing-location">
            <MapPin size={15} />
            {listing.location}, {listing.municipality} · omtrentlig område
          </p>
        </div>
        <div className="button-row">
          {rental && (
            <button
              className="button outline"
              onClick={() => toggleFavorite(listing.id)}
              aria-pressed={favorites.includes(listing.id)}
            >
              <Heart
                size={17}
                fill={favorites.includes(listing.id) ? "currentColor" : "none"}
              />
              {favorites.includes(listing.id) ? "Lagret" : "Lagre"}
            </button>
          )}
          <button
            className="button outline"
            onClick={async () => {
              if (window.location.protocol === "file:") {
                setShare(
                  "Dette er en lokal demo. Del HTML-filen, ikke adressen i nettleseren.",
                );
                return;
              }
              try {
                await navigator.clipboard.writeText(window.location.href);
                setShare("Lenken er kopiert.");
              } catch {
                setShare("Kopier adressen fra nettleserens adressefelt.");
              }
            }}
          >
            <Share2 size={17} />
            Del
          </button>
        </div>
      </div>
      {share && (
        <p role="status" className="inline-success">
          {share}
        </p>
      )}
      <div className="detail-layout">
        <div className="detail-main">
          {rental ? (
            <>
              <button
                className="gallery-main"
                onClick={() => setLightbox(true)}
                aria-label="Forstørr eksempelbildet"
              >
                <Image
                  src={`/images/equipment-${rental.imageIndex + 1}.webp`}
                  alt={`${listing.title} – KI-generert produktbilde`}
                  fill
                  priority
                  sizes="(max-width:800px) 100vw, 60vw"
                />
                <span>
                  <ZoomIn size={16} />
                  Se bildet
                </span>
              </button>
              <p className="image-caption">
                KI-generert eksempelbilde · ikke et bilde av faktisk utstyr til
                leie.
              </p>
              <dialog
                className="gallery-dialog"
                ref={dialog}
                onCancel={() => setLightbox(false)}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setLightbox(false);
                }}
                aria-label="Forstørret eksempelbilde"
              >
                <button
                  className="icon-button"
                  aria-label="Lukk bilde"
                  onClick={() => setLightbox(false)}
                >
                  <X />
                </button>
                <Image
                  src={`/images/equipment-${rental.imageIndex + 1}.webp`}
                  alt={listing.title}
                  width={1024}
                  height={768}
                  className="lightbox-image"
                />
              </dialog>
            </>
          ) : (
            <div className="wanted-detail-art">
              <span className="wanted-badge">Ønskes leid</span>
              <h2>
                Noen trenger kanskje
                <br />
                akkurat det du har.
              </h2>
              <Heart size={65} strokeWidth={1} />
              <p>Eksempel på et lokalt ønske i {listing.location}</p>
            </div>
          )}
          <section className="detail-section">
            <h2>{rental ? "Litt om utstyret" : "Dette ser jeg etter"}</h2>
            <p>{listing.description}</p>
          </section>
          {rental && (
            <>
              <section className="detail-section">
                <h2>Dette følger med</h2>
                <ul className="included-list">
                  {rental.included.map((x) => (
                    <li key={x}>
                      <Check size={17} />
                      {x}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="detail-section">
                <h2>Godt å vite før du leier</h2>
                <ul className="rules-list">
                  {rental.rules.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
              <section className="detail-section">
                <h2>Henting og levering</h2>
                <div className="pickup-note">
                  <MapPin />
                  <div>
                    <strong>Hentes i {listing.location}</strong>
                    <p>
                      Nøyaktig hentested deles først etter avtale ved lansering.
                    </p>
                  </div>
                </div>
                {rental.deliveryAvailable && (
                  <div className="pickup-note">
                    <Truck />
                    <div>
                      <strong>Kan leveres · +{rental.deliveryPrice} kr</strong>
                      <p>
                        Eksempelpris innen Steigen. Område og tidspunkt avtales
                        senere.
                      </p>
                    </div>
                  </div>
                )}
              </section>
              <section className="detail-section">
                <h2>Eksempel på tilgjengelighet</h2>
                <Calendar unavailable={rental.availability.unavailable} />
                <p className="fine-print">{rental.availability.note}</p>
              </section>
            </>
          )}
          <section className="detail-section">
            <h2>I nærheten av {listing.location}</h2>
            <div className="approx-map">
              <svg
                viewBox="0 0 700 180"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect width="700" height="180" fill="#d7e7e8" />
                <path d="M180 0q200 30 145 94t260 86H700V0Z" fill="#dce3cd" />
                <path
                  d="M460 0q-100 85 20 180"
                  fill="none"
                  stroke="#fffef9"
                  strokeWidth="7"
                />
                <circle cx="450" cy="75" r="50" fill="#174d3c" opacity=".12" />
              </svg>
              <span>
                <MapPin size={24} />
                {listing.location}
              </span>
            </div>
            <p className="fine-print">
              Illustrasjon av et område, ingen presis adresse eller reell
              eiendom.
            </p>
          </section>
        </div>
        <aside className="booking-sidebar">
          <div className="booking-card">
            {rental ? (
              <>
                <p className="eyebrow">TIL LEIE · EKSEMPELPRIS</p>
                <div className="detail-price">
                  <strong>{nok(selectedPrice?.[1] ?? 0)} kr</strong>
                  <span>/ {units[selectedPrice?.[0] ?? "day"]}</span>
                </div>
                <div className="price-options">
                  {prices.map(([u, p]) => (
                    <button
                      key={u}
                      className={selectedPrice?.[0] === u ? "selected" : ""}
                      aria-pressed={selectedPrice?.[0] === u}
                      onClick={() => setUnit(u)}
                    >
                      {units[u]}
                      <strong>{nok(p)} kr</strong>
                    </button>
                  ))}
                </div>
                {rental.deliveryAvailable && (
                  <label className="delivery-check">
                    <input
                      type="checkbox"
                      checked={delivery}
                      onChange={(e) => {
                        setDelivery(e.target.checked);
                        if (e.target.checked)
                          track("delivery_interest_clicked", {
                            listingId: listing.id,
                          });
                      }}
                    />
                    <Truck size={18} />
                    <span>
                      Jeg er interessert i levering
                      <small>+{rental.deliveryPrice} kr innen Steigen</small>
                    </span>
                  </label>
                )}
                <div className="price-total">
                  <span>Eksempelpris{delivery ? " med levering" : ""}</span>
                  <strong>
                    {nok(
                      (selectedPrice?.[1] ?? 0) +
                        (delivery ? (rental.deliveryPrice ?? 0) : 0),
                    )}{" "}
                    kr
                  </strong>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">ØNSKES LEID</p>
                <h2>
                  {listing.listingType === "wanted" ? listing.budget : ""}
                </h2>
                <p>
                  <CalendarDays size={16} />{" "}
                  {listing.listingType === "wanted" ? listing.period : ""}
                </p>
              </>
            )}
            <button className="button primary full-width" onClick={intent}>
              {rental ? "Send forespørsel" : "Jeg har dette"}
              <ArrowRight size={17} />
            </button>
            <p className="booking-note">
              <ShieldCheck size={14} />
              Ingen reservasjon eller betaling. Dette er en demo.
            </p>
            <div className="owner-card">
              <Link
                className="owner-avatar"
                href={`/profil/${owner.id}`}
                aria-label={`Se eksempelprofilen til ${owner.displayName}`}
              >
                {owner.displayName.charAt(0)}
              </Link>
              <div>
                <Link href={`/profil/${owner.id}`}>
                  <strong>{owner.displayName}</strong>{" "}
                  <ArrowUpRight size={13} />
                </Link>
                <span>Eksempelprofil · {owner.location.localArea}</span>
              </div>
            </div>
            <span className="planned-label">
              BankID og vurderinger: kommer ved lansering
            </span>
          </div>
          <div className="sidebar-research">
            <h3>Kunne dette vært noe for deg?</h3>
            <p>Vi bygger Lånndet sammen med folk i Steigen.</p>
            <button
              className="text-link"
              onClick={() => open({ type: "survey" })}
            >
              Gi oss dine tanker <ArrowRight size={16} />
            </button>
          </div>
        </aside>
      </div>
      <section className="section">
        <div className="section-heading">
          <h2>Mer du kan ha bruk for.</h2>
          <Link href="/utforsk" className="text-link">
            Se alle <ArrowRight size={16} />
          </Link>
        </div>
        <div className="listing-grid">
          {demoListings
            .filter((l) => l.id !== listing.id)
            .sort(
              (a, b) =>
                Number(b.category === listing.category) -
                Number(a.category === listing.category),
            )
            .slice(0, 4)
            .map((l) => (
              <ListingCard listing={l} key={l.id} />
            ))}
        </div>
      </section>
    </div>
  );
}
function Calendar({ unavailable }: { unavailable: string[] }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState("");
  const month = new Date(Date.UTC(2026, 9 + offset, 1));
  const year = month.getUTCFullYear();
  const m = month.getUTCMonth();
  const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  const start = (month.getUTCDay() + 6) % 7;
  return (
    <div className="calendar">
      <div className="calendar-heading">
        <strong>
          {new Intl.DateTimeFormat("nb-NO", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(month)}
        </strong>
        <div>
          <button
            className="icon-button"
            aria-label="Forrige måned"
            disabled={offset <= 0}
            onClick={() => {
              setOffset(offset - 1);
              setSelected("");
            }}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Neste måned"
            onClick={() => {
              setOffset(offset + 1);
              setSelected("");
            }}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["ma", "ti", "on", "to", "fr", "lø", "sø"].map((d) => (
          <span className="weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: start }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          const blocked = unavailable.includes(date);
          return (
            <button
              key={date}
              disabled={blocked}
              className={selected === date ? "selected" : ""}
              aria-label={`${i + 1}. ${new Intl.DateTimeFormat("nb-NO", { month: "long", timeZone: "UTC" }).format(month)}${blocked ? ", utilgjengelig" : ""}`}
              aria-pressed={selected === date}
              onClick={() => setSelected(date)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="fine-print" role="status">
        {selected
          ? `Valgt eksempeldato: ${selected}. Datoen blir ikke reservert.`
          : "Velg en dag for å prøve kalenderen."}
      </p>
    </div>
  );
}
