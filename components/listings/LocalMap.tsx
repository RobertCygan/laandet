"use client";
import { useState } from "react";
import { MapPin, Compass, ChevronRight } from "lucide-react";
import type { Listing, WantedListing } from "@/types";
import { nok } from "@/lib/config";
import { ListingCard, WantedCard } from "./ListingCard";
export function LocalMap({
  listings,
}: {
  listings: (Listing | WantedListing)[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const item = listings.find((l) => l.id === selected);
  const groups = Object.values(
    listings.reduce<Record<string, (Listing | WantedListing)[]>>((all, l) => {
      (all[l.location] ??= []).push(l);
      return all;
    }, {}),
  );
  // Deliberately illustrative positions keep nearby areas and grouped markers usable.
  // New areas fall back to their approximate coordinates, never a street address.
  const positions: Record<string, [number, number]> = {
    Leinesfjord: [53, 73],
    Leines: [31, 64],
    Nordfold: [75, 80],
    Engeløya: [40, 26],
    Nordskot: [23, 44],
    Bogøy: [85, 29],
    Helnessund: [18, 78],
    Bogen: [65, 50],
  };
  const activeGroup = groups.find((g) => g.some((l) => l.id === selected));
  return (
    <div className="map-layout">
      <div className="local-map">
        <svg
          viewBox="0 0 800 560"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect width="800" height="560" fill="#d9e7e9" />
          <path
            d="m520 0-40 65 25 45-70 48 28 62-63 49 39 33-70 70 23 50-63 42-8 96H800V0Z"
            fill="#e6e9d7"
            stroke="#b8c6b2"
            strokeWidth="2"
          />
          <path
            d="m164 83 72-38 68 19 41 55-34 67-93 23-65-48Z"
            fill="#e6e9d7"
            stroke="#b8c6b2"
            strokeWidth="2"
          />
          <path
            d="m158 314 55-45 49 14 19 40-31 55-57-9Z"
            fill="#e6e9d7"
            stroke="#b8c6b2"
          />
          <path
            d="m78 234 24-31 43 14 7 34-40 25Z"
            fill="#e6e9d7"
            stroke="#b8c6b2"
          />
          <path
            d="m428 560 36-99-3-81 53-61-4-80 54-67 13-83 47-89M224 74l17 59 49 21 31 23 142 62M461 380l-76-23-110-20-60-22"
            fill="none"
            stroke="#fffdf7"
            strokeWidth="6"
          />
          <path
            d="m428 560 36-99-3-81 53-61-4-80 54-67 13-83 47-89M224 74l17 59 49 21 31 23 142 62M461 380l-76-23-110-20-60-22"
            fill="none"
            stroke="#cfbda3"
            strokeWidth="1.2"
          />
          <g fill="#688370" fontSize="15" fontFamily="sans-serif">
            <text x="210" y="111">
              Engeløya
            </text>
            <text x="545" y="195">
              Steigen
            </text>
            <text x="80" y="425" fill="#698995" fontStyle="italic">
              Vestfjorden
            </text>
          </g>
        </svg>
        <span className="map-compass">
          <Compass size={27} />N
        </span>
        {groups.map((group) => {
          const l = group[0];
          const [x, y] = positions[l.location] ?? [
            Math.max(
              12,
              Math.min(85, ((l.coordinatesApprox[1] - 14.65) / 0.85) * 100),
            ),
            Math.max(
              12,
              Math.min(85, ((68 - l.coordinatesApprox[0]) / 0.3) * 100),
            ),
          ];
          return (
            <button
              key={l.location}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`map-marker ${group.some((l) => l.id === selected) ? "selected" : ""}`}
              aria-label={`Vis ${l.title}, ${l.location}`}
              onClick={() => setSelected(l.id)}
            >
              {l.listingType === "rental" ? (
                `${nok(l.priceDay ?? l.priceWeekend ?? 0)} kr`
              ) : (
                <MapPin size={17} />
              )}
              <span className="map-marker-count">· {group.length}</span>
            </button>
          );
        })}
        <span className="map-caption">
          Illustrasjonskart · omtrentlige områder, ingen private adresser
        </span>
      </div>
      <div className="map-preview">
        {item ? (
          <>
            {item.listingType === "rental" ? (
              <ListingCard listing={item} />
            ) : (
              <WantedCard listing={item} />
            )}
            {activeGroup && activeGroup.length > 1 && (
              <div className="map-pagination">
                <span>
                  {activeGroup.findIndex((l) => l.id === selected) + 1} av{" "}
                  {activeGroup.length} i {item.location}
                </span>
                <button
                  className="icon-button"
                  aria-label="Neste annonse i området"
                  onClick={() =>
                    setSelected(
                      activeGroup[
                        (activeGroup.findIndex((l) => l.id === selected) + 1) %
                          activeGroup.length
                      ].id,
                    )
                  }
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="map-empty">
            <MapPin size={35} />
            <h3>Et helt nabolag av muligheter.</h3>
            <p>Trykk på en markør for å se en eksempelannonse.</p>
          </div>
        )}
      </div>
    </div>
  );
}
