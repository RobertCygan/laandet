"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  Map,
  LayoutGrid,
  X,
  Truck,
  SearchX,
  Heart,
} from "lucide-react";
import { demoListings, demoWanted } from "@/data/demoListings";
import { categories, areas } from "@/data/categories";
import { ListingCard, WantedCard } from "./ListingCard";
import { LocalMap } from "./LocalMap";
import { track } from "@/lib/research";
import { useResearch } from "@/components/research/ResearchProvider";
import type { Listing, WantedListing, PriceUnit } from "@/types";
import { units } from "@/lib/config";
export function Explore({ initial }: { initial: Record<string, string> }) {
  const { favorites } = useResearch();
  const [q, setQ] = useState(initial.q ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [type, setType] = useState(
    initial.type === "wanted" ? "wanted" : "rental",
  );
  const [delivery, setDelivery] = useState(initial.delivery === "1");
  const [favoriteOnly, setFavoriteOnly] = useState(initial.favorites === "1");
  const [maxPrice, setMaxPrice] = useState(2000);
  const [unit, setUnit] = useState<PriceUnit | "any">("any");
  const [sort, setSort] = useState("relevant");
  const [map, setMap] = useState(false);
  const [filters, setFilters] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const dateError = from && to && from > to;
  const normalized = q.toLocaleLowerCase("nb").trim();
  const items: (Listing | WantedListing)[] = (
    type === "rental" ? demoListings : demoWanted
  )
    .filter((l) => {
      const haystack =
        `${l.id} ${l.title} ${l.description} ${l.location} ${categories.find((c) => c.id === l.category)?.name}`.toLocaleLowerCase(
          "nb",
        );
      const matches = normalized
        .split(/\s+/)
        .every((word) => haystack.includes(word));
      if (
        !matches ||
        (category && l.category !== category) ||
        (location && l.location !== location)
      )
        return false;
      if (l.listingType === "wanted")
        return !delivery && !favoriteOnly && (l.budgetMax ?? 0) <= maxPrice;
      const price =
        unit === "any"
          ? (l.priceDay ?? l.priceWeekend ?? l.priceWeek ?? l.priceHour)
          : unit === "day"
            ? l.priceDay
            : unit === "hour"
              ? l.priceHour
              : unit === "weekend"
                ? l.priceWeekend
                : l.priceWeek;
      if (price === undefined || price > maxPrice) return false;
      if (delivery && !l.deliveryAvailable) return false;
      if (favoriteOnly && !favorites.includes(l.id)) return false;
      if (
        from &&
        l.availability.unavailable.some((d) => d >= from && d <= (to || from))
      )
        return false;
      return !dateError;
    })
    .sort((a, b) => {
      if (sort === "price") {
        const p = (l: Listing | WantedListing) =>
          l.listingType === "wanted"
            ? (l.budgetMax ?? 0)
            : ((unit === "any"
                ? (l.priceDay ?? l.priceWeekend ?? l.priceWeek ?? l.priceHour)
                : unit === "day"
                  ? l.priceDay
                  : unit === "hour"
                    ? l.priceHour
                    : unit === "weekend"
                      ? l.priceWeekend
                      : l.priceWeek) ?? 0);
        return p(a) - p(b);
      }
      if (sort === "title") return a.title.localeCompare(b.title, "nb");
      return 0;
    });
  function reset() {
    setQ("");
    setCategory("");
    setLocation("");
    setDelivery(false);
    setFavoriteOnly(false);
    setMaxPrice(2000);
    setUnit("any");
    setFrom("");
    setTo("");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    track("search_performed", {
      query: q,
      category,
      location: location || "Steigen",
      type,
    });
  }
  return (
    <div className="container explore-page">
      <div className="breadcrumb">
        <Link href="/">Hjem</Link>
        <span>/</span>
        <span>Utforsk</span>
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">LITT NÆRMERE DET DU TRENGER</p>
          <h1>Utforsk nabolaget.</h1>
          <p className="muted">Fra nyttige verktøy til neste lille eventyr.</p>
        </div>
        <Link href="/ny-annonse" className="text-link">
          Har du noe å dele? <span>↗</span>
        </Link>
      </div>
      <form className="explore-search" onSubmit={submit}>
        <Search size={22} />
        <input
          aria-label="Søk i annonser"
          placeholder="Hva trenger du?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button
            type="button"
            className="icon-button"
            aria-label="Tøm søk"
            onClick={() => setQ("")}
          >
            <X size={18} />
          </button>
        )}
        <button className="button primary" type="submit">
          Søk
        </button>
      </form>
      <div className="explore-toolbar">
        <div className="segmented" role="group" aria-label="Annonsetype">
          <button
            aria-pressed={type === "rental"}
            className={type === "rental" ? "selected" : ""}
            onClick={() => {
              setType("rental");
              setDelivery(false);
              setFavoriteOnly(false);
            }}
          >
            Til leie
          </button>
          <button
            aria-pressed={type === "wanted"}
            className={type === "wanted" ? "selected" : ""}
            onClick={() => {
              setType("wanted");
              setDelivery(false);
              setFavoriteOnly(false);
            }}
          >
            Ønskes leid
          </button>
        </div>
        <div className="toolbar-actions">
          <button
            className="button outline mobile-filter"
            onClick={() => setFilters(!filters)}
            aria-expanded={filters}
          >
            <SlidersHorizontal size={17} />
            Filtre
          </button>
          <div className="view-switch" role="group" aria-label="Visning">
            <button
              aria-label="Listevisning"
              aria-pressed={!map}
              className={!map ? "selected" : ""}
              onClick={() => setMap(false)}
            >
              <LayoutGrid size={17} />
              <span>Liste</span>
            </button>
            <button
              aria-label="Kartvisning"
              aria-pressed={map}
              className={map ? "selected" : ""}
              onClick={() => setMap(true)}
            >
              <Map size={17} />
              <span>Kart</span>
            </button>
          </div>
        </div>
      </div>
      <div className="explore-layout">
        <aside
          className={`filters ${filters ? "filters-open" : ""}`}
          aria-label="Filtrer annonser"
        >
          <div className="filter-header">
            <h2>
              <SlidersHorizontal size={17} />
              Filtrer
            </h2>
            <button onClick={reset}>Nullstill</button>
          </div>
          <label className="field">
            Kategori
            <select
              aria-label="Kategori"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                track("category_opened", { category: e.target.value });
              }}
            >
              <option value="">Alle kategorier</option>
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Område
            <select
              aria-label="Område"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="">Hele Steigen</option>
              {areas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <div className="filter-divider" />
          <label className="field">
            {type === "rental" ? "Pris per" : "Budsjett per ønske"}
            {type === "rental" && (
              <select
                aria-label="Prisintervall"
                value={unit}
                onChange={(e) => setUnit(e.target.value as PriceUnit | "any")}
              >
                <option value="any">Alle perioder</option>
                {Object.entries(units).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="range-label" htmlFor="max-price">
            Maks. {maxPrice.toLocaleString("nb-NO")} kr
          </label>
          <input
            id="max-price"
            type="range"
            min={0}
            max={2000}
            step={25}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
          <div className="range-ends">
            <span>0 kr</span>
            <span>2 000 kr</span>
          </div>
          {type === "rental" && (
            <>
              <div className="filter-divider" />
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={delivery}
                  onChange={(e) => {
                    setDelivery(e.target.checked);
                    if (e.target.checked)
                      track("delivery_interest_clicked", { source: "filter" });
                  }}
                />
                <Truck size={16} />
                Kan leveres
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={favoriteOnly}
                  onChange={(e) => setFavoriteOnly(e.target.checked)}
                />
                <Heart size={16} />
                Mine favoritter
              </label>
              <div className="filter-divider" />
              <label className="field">
                Fra dato
                <input
                  aria-label="Fra dato"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="field">
                Til dato
                <input
                  aria-label="Til dato"
                  type="date"
                  min={from}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              {dateError && (
                <p role="alert" className="form-error">
                  Sluttdato må være etter startdato.
                </p>
              )}
              <p className="fine-print">
                Eksempelkalender, ingen reservasjon. 24.–25. oktober 2026 er
                markert utilgjengelig.
              </p>
            </>
          )}
          <div className="filter-info">
            <span className="demo-badge static">Demoannonser</span>
            <p>Vi tester en idé i Steigen. Ingen annonser er aktive ennå.</p>
          </div>
        </aside>
        <div className="explore-results">
          <div className="results-heading">
            <p>
              <strong>{items.length}</strong>{" "}
              {type === "rental" ? "eksempelannonser" : "ønsker"}
              {location ? ` i ${location}` : " i Steigen"}
            </p>
            <label className="sort-label">
              Sorter
              <select
                aria-label="Sorter annonser"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="relevant">Anbefalt</option>
                <option value="price">Laveste pris</option>
                <option value="title">Tittel A–Å</option>
              </select>
            </label>
          </div>
          {items.length === 0 ? (
            <div className="empty-results">
              <SearchX size={45} strokeWidth={1.3} />
              <h2>Ikke helt det du lette etter?</h2>
              <p>Prøv et annet søk eller legg ut hva du ønsker å leie.</p>
              <div className="button-row">
                <button className="button outline" onClick={reset}>
                  Nullstill filtre
                </button>
                <Link className="button primary" href="/ny-annonse?type=wanted">
                  Legg ut et ønske
                </Link>
              </div>
            </div>
          ) : map ? (
            <LocalMap listings={items} />
          ) : (
            <div
              className={
                type === "rental"
                  ? "listing-grid explore-grid"
                  : "wanted-grid explore-grid"
              }
            >
              {items.map((l) =>
                l.listingType === "rental" ? (
                  <ListingCard listing={l} key={l.id} />
                ) : (
                  <WantedCard listing={l} key={l.id} />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
