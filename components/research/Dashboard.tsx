"use client";
import { useSyncExternalStore, useState } from "react";
import {
  Download,
  BarChart3,
  ArrowUpRight,
  Eye,
  HeartHandshake,
  MessageCircle,
  Truck,
  Users,
  RefreshCcw,
} from "lucide-react";
import { STORAGE_KEYS } from "@/lib/config";
import { readLocal, downloadJson } from "@/lib/research";
import { categoryName } from "@/data/categories";
import type { ResearchEvent, ResearchResponse } from "@/types";
function subscribe(callback: () => void) {
  window.addEventListener("laanndet:storage", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("laanndet:storage", callback);
    window.removeEventListener("storage", callback);
  };
}
function snapshot() {
  try {
    return JSON.stringify([
      localStorage.getItem(STORAGE_KEYS.events),
      localStorage.getItem(STORAGE_KEYS.surveys),
    ]);
  } catch {
    return "[null,null]";
  }
}
export function Dashboard() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[null,null]");
  const [notice, setNotice] = useState("");
  const [e, s] = JSON.parse(raw) as [string | null, string | null];
  const events: ResearchEvent[] = e ? JSON.parse(e) : [];
  const surveys: ResearchResponse[] = s ? JSON.parse(s) : [];
  const count = (name: string) => events.filter((e) => e.name === name).length;
  const opened = events.filter((e) => e.name === "listing_opened");
  const rent = events.filter(
    (e) => e.name === "rent_cta_clicked" && e.data.stage === "opened",
  );
  const owners = events.filter(
    (e) => e.name === "create_listing_started" && e.data.type === "rental",
  );
  const wanted = events.filter(
    (e) => e.name === "have_this_clicked" && Boolean(e.data.answer),
  );
  function tally(values: string[]) {
    return Object.entries(
      values
        .filter(Boolean)
        .reduce<Record<string, number>>(
          (a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }),
          {},
        ),
    ).sort((a, b) => b[1] - a[1]);
  }
  const byCategory = tally(
    events
      .filter((e) =>
        ["listing_opened", "category_opened", "wanted_listing_opened"].includes(
          e.name,
        ),
      )
      .map((e) => categoryName(String(e.data.category ?? ""))),
  );
  const byLocation = tally(
    events
      .filter((e) =>
        ["listing_opened", "wanted_listing_opened"].includes(e.name),
      )
      .map((e) => String(e.data.location ?? "")),
  );
  return (
    <div className="container dashboard-page">
      <div className="dashboard-top">
        <div>
          <p className="eyebrow">LÅNNDET · LOKALT RESEARCHVERKTØY</p>
          <h1>Hva vekker interesse?</h1>
          <p>
            Reelle handlinger fra denne nettleseren. Ingen syntetiske
            brukertall.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            downloadJson(
              {
                exportedAt: new Date().toISOString(),
                scope: "This browser only; not representative of all visitors",
                events,
                surveys,
                launchInterests: readLocal(STORAGE_KEYS.interests, []),
              },
              `laanndet-research-${new Date().toISOString().slice(0, 10)}.json`,
            );
            setNotice(
              "Eksportert. Filen kan inneholde frivillig oppgitt kontaktinformasjon. Behandle den fortrolig.",
            );
          }}
        >
          <Download size={17} />
          Eksporter lokale data
        </button>
      </div>
      <div className="research-banner">
        <BarChart3 size={21} />
        <p>
          <strong>Ingen sentral innsamling.</strong> Denne skjulte demoruten er
          ikke en beskyttet administrasjonsløsning. Den viser bare data lagret
          på enheten din. For ekte feltstudier trengs serverlagring og
          tilgangskontroll.
        </p>
      </div>
      {notice && (
        <p role="status" className="inline-success">
          {notice}
        </p>
      )}
      <div className="metric-grid">
        {[
          [Users, "Nettlesere registrert", events.length ? 1 : 0],
          [Eye, "Åpnede leieannonser", opened.length],
          [ArrowUpRight, "Leieinteresse", rent.length],
          [HeartHandshake, "Utleieinteresse", owners.length],
          [MessageCircle, "Svar på ønsker", wanted.length],
          [BarChart3, "Fullførte spørreskjema", surveys.length],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof Users;
          return (
            <div className="metric" key={String(label)}>
              <I size={21} />
              <strong>{String(value)}</strong>
              <span>{String(label)}</span>
            </div>
          );
        })}
      </div>
      <div className="chart-grid">
        <BarChart
          title="Interesse etter kategori"
          subtitle="Annonseåpninger og kategorivalg"
          rows={byCategory}
        />
        <BarChart
          title="Leie eller leie ut?"
          subtitle="Besvarte spørreskjema"
          rows={tally(surveys.map((s) => s.purpose))}
        />
        <BarChart
          title="Interesse etter sted"
          subtitle="Området i åpnet eksempelannonse"
          rows={byLocation}
        />
        <BarChart
          title="Gjør levering en forskjell?"
          subtitle={`${count("delivery_interest_clicked")} handlinger viser leveringsinteresse`}
          rows={tally(surveys.map((s) => s.delivery))}
        />
        <BarChart
          title="Akseptabel henteavstand"
          subtitle="Besvarte spørreskjema"
          rows={tally(surveys.map((s) => s.distance))}
        />
        <div className="chart-card">
          <h2>Fra nysgjerrighet til interesse</h2>
          <p>Åpnet annonse → trykket «Send forespørsel»</p>
          <div className="conversion">
            <strong>
              {opened.length
                ? Math.round((rent.length / opened.length) * 100)
                : 0}
              <span>%</span>
            </strong>
            <ArrowUpRight size={35} />
          </div>
          <p>
            {rent.length} klikk / {opened.length} åpninger. Hendelsesforhold,
            ikke unike personer. Gjentatte klikk kan gi over 100 %.
          </p>
          <span className="planned-label">
            Utvalget er kun denne nettleseren
          </span>
        </div>
      </div>
      <section className="dashboard-table">
        <h2>Siste anonyme hendelser</h2>
        <p>Fritekst og kontaktinformasjon vises ikke i hendelseslisten.</p>
        {events.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tidspunkt</th>
                  <th>Hendelse</th>
                  <th>Kategori / kilde</th>
                </tr>
              </thead>
              <tbody>
                {[...events]
                  .reverse()
                  .slice(0, 25)
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        {new Intl.DateTimeFormat("nb-NO", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "Europe/Oslo",
                        }).format(new Date(e.createdAt))}
                      </td>
                      <td>{e.name}</td>
                      <td>
                        {String(
                          e.data.category ??
                            e.data.source ??
                            e.data.path ??
                            "–",
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="chart-empty">
            <RefreshCcw size={24} />
            <p>Ingen lokale hendelser ennå. Utforsk nettstedet først.</p>
          </div>
        )}
      </section>
    </div>
  );
}
function BarChart({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: [string, number][];
}) {
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <section className="chart-card">
      <h2>{title}</h2>
      <p>{subtitle}</p>
      {rows.length ? (
        <div className="bars">
          {rows.slice(0, 8).map(([label, value]) => (
            <div key={label}>
              <div className="bar-label">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
              <div className="bar-track">
                <span style={{ width: `${(value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="chart-empty">
          <Truck size={25} />
          <p>Ingen svar i denne nettleseren ennå.</p>
        </div>
      )}
    </section>
  );
}
