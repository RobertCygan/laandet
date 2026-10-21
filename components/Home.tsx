"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Search,
  MapPin,
  ArrowRight,
  ArrowUpRight,
  Check,
  Truck,
  HeartHandshake,
  ShieldCheck,
  Sprout,
  ChevronDown,
  Plus,
  CircleHelp,
  KeyRound,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import { CategoryIcon, Logo } from "@/components/Icon";
import { ListingCard, WantedCard } from "@/components/listings/ListingCard";
import { categories, areas } from "@/data/categories";
import { demoListings, demoWanted } from "@/data/demoListings";
import { useResearch } from "@/components/research/ResearchProvider";
import { track } from "@/lib/research";
export const faqs = [
  [
    "Hva er Lånndet?",
    "Lånndet er en idé om en lokal markedsplass der du kan leie ting av folk i nærheten, leie ut det du eier og legge ut det du ønsker å leie. Vi starter i Steigen.",
  ],
  [
    "Er Lånndet lansert?",
    "Ikke ennå. Dette er en testversjon som skal hjelpe oss å forstå hva folk i Steigen faktisk trenger. Du kan utforske, prøve skjemaene og gi tilbakemelding.",
  ],
  [
    "Er annonsene ekte?",
    "Nei. Alle annonser og profiler her er fiktive eksempler, tydelig merket som demo. Bildene er KI-genererte. Ingen utleier kan kontaktes og ingen ting kan reserveres.",
  ],
  [
    "Hva vil det koste å bruke Lånndet?",
    "Endelige priser og eventuelle tjenestegebyrer er ikke bestemt. Prisene i demoannonsene er eksempler vi bruker for å teste hva som kan passe lokalt.",
  ],
  [
    "Hvordan skal betaling fungere?",
    "Vi planlegger enkel betaling med Vipps ved lansering. Det finnes ingen aktiv betalingsløsning eller avtale om Vipps-integrasjon i denne versjonen.",
  ],
  [
    "Kan jeg tilby levering?",
    "Det er planen! Du skal kunne velge om du vil levere, til hvilken pris og innenfor hvilket område. I demoen kan du se og prøve levering som et eksempel.",
  ],
  [
    "Hva skjer hvis noe blir ødelagt?",
    "Løsninger for skade, depositum og eventuell forsikring må avklares før lansering. Det er ingen aktiv forsikringsdekning i testversjonen.",
  ],
  [
    "Kommer BankID?",
    "BankID-verifisering er en planlagt funksjon, men er ikke integrert ennå. Ingen av eksempelprofilene er identitetsverifisert.",
  ],
  [
    "Hvor starter Lånndet?",
    "Vi begynner i Steigen kommune i Nordland. Målet er å lære lokalt og senere kunne åpne i flere kommuner.",
  ],
];
export function Home() {
  const router = useRouter();
  const { open } = useResearch();
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [type, setType] = useState<"rental" | "wanted">("rental");
  const [role, setRole] = useState<"rent" | "owner">("rent");
  function search(e: FormEvent) {
    e.preventDefault();
    track("search_performed", { query: q, location: area || "Steigen", type });
    const p = new URLSearchParams({ q, type });
    if (area) p.set("location", area);
    router.push(`/utforsk?${p}`);
  }
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <span className="pill local-pill">
            <span className="live-dot" /> GODE NABOER. GODE MULIGHETER.
          </span>
          <h1>
            Lei det du trenger.
            <br />
            <span>Lån bort det du har.</span>
          </h1>
          <p className="hero-description">
            Det du trenger, finnes kanskje rett i nærheten.
            <br className="desktop-break" /> Lei lokalt – og la tingene dine
            komme til nytte.
          </p>
          <div className="hero-cta">
            <Link href="/utforsk" className="button primary">
              Finn noe å leie <ArrowUpRight size={18} />
            </Link>
            <Link href="/ny-annonse" className="button subtle">
              Lei ut noe du har <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-benefits">
            <span>
              <Check size={15} />
              Enklere hverdag
            </span>
            <span>
              <Check size={15} />
              Mer for pengene
            </span>
            <span>
              <Check size={15} />
              Nærmere deg
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <Image
            src="/images/hero.webp"
            fill
            priority
            sizes="(max-width: 700px) 100vw, 55vw"
            alt="KI-generert kystlandskap i Nordland med naust, kajakk og hageutstyr"
          />
          <div className="hero-location">
            <MapPin size={14} /> Små avstander. Store muligheter.
          </div>
          <div className="hero-note">
            <span className="note-icon">
              <HeartHandshake size={24} />
            </span>
            <div>
              <strong>Fra bod til nytte.</strong>
              <span>Det er mye vi kan dele.</span>
            </div>
            <Sprout size={25} />
          </div>
          <span className="image-disclaimer">
            Illustrasjonsbilde · KI-generert
          </span>
        </div>
      </section>
      <section
        className="container search-section"
        aria-label="Søk etter utstyr"
      >
        <form className="home-search" onSubmit={search}>
          <label className="search-query">
            <Search size={23} />
            <span>
              <span className="search-label">HVA TRENGER DU?</span>
              <input
                aria-label="Hva trenger du?"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Prøv «tilhenger» eller «tepperenser»"
              />
            </span>
          </label>
          <label className="search-place">
            <MapPin size={21} />
            <span>
              <span className="search-label">I NÆRHETEN AV</span>
              <select
                aria-label="Velg område"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                <option value="">Hele Steigen</option>
                {areas.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </span>
            <ChevronDown size={14} />
          </label>
          <button type="submit" className="button primary">
            <Search size={18} />
            Søk i nabolaget
          </button>
        </form>
        <div className="search-suggestions">
          <span>Mange trenger:</span>
          {[
            "Tilhenger",
            "Høytrykksspyler",
            "Motorsag",
            "Ski",
            "Tepperenser",
          ].map((x) => (
            <Link
              key={x}
              href={`/utforsk?q=${encodeURIComponent(x)}`}
              onClick={() =>
                track("search_performed", { query: x, source: "suggestion" })
              }
            >
              {x}
            </Link>
          ))}
        </div>
      </section>
      <div className="container">
        <div className="research-banner">
          <CircleHelp size={18} />
          <p>
            <strong>Vi bygger Lånndet sammen.</strong> Lånndet er under
            utvikling. Annonsene du ser nå er eksempler brukt for å teste
            interessen for tjenesten i Steigen.
          </p>
          <button onClick={() => open({ type: "survey" })}>
            Si din mening <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <section className="container section" id="utforsk">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FINN DET DU TRENGER, NÆR DEG</p>
            <h2>Små behov. Lokale løsninger.</h2>
          </div>
          <div className="segmented" role="group" aria-label="Annonsetype">
            <button
              className={type === "rental" ? "selected" : ""}
              aria-pressed={type === "rental"}
              onClick={() => setType("rental")}
            >
              Til leie
            </button>
            <button
              className={type === "wanted" ? "selected" : ""}
              aria-pressed={type === "wanted"}
              onClick={() => setType("wanted")}
            >
              Ønskes leid
            </button>
          </div>
        </div>
        <div className="section-subheading">
          <h3>
            {type === "rental"
              ? "Dette kan du leie i nærheten"
              : "Noen i nærheten trenger kanskje det du har"}
          </h3>
          <Link className="text-link" href={`/utforsk?type=${type}`}>
            Se alle {type === "rental" ? "annonser" : "ønsker"}{" "}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div
          className={
            type === "rental" ? "listing-grid home-listings" : "wanted-grid"
          }
        >
          {type === "rental"
            ? demoListings
                .slice(0, 4)
                .map((l) => <ListingCard listing={l} key={l.id} />)
            : demoWanted
                .slice(0, 3)
                .map((l) => <WantedCard listing={l} key={l.id} />)}
        </div>
        <p className="section-footnote">
          Eksempler på hva vi kan dele i Steigen. Ingen annonser er aktive ennå.
        </p>
      </section>
      <section className="categories-section" id="kategorier">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                FRA SMÅ PROSJEKTER TIL STORE OPPLEVELSER
              </p>
              <h2>Hva har du på planen?</h2>
            </div>
            <Link href="/kategorier" className="text-link">
              Utforsk alle kategorier <ArrowRight size={17} />
            </Link>
          </div>
          <div className="category-grid">
            {[
              categories[0],
              categories[4],
              categories[2],
              categories[13],
              categories[6],
              categories[8],
            ].map((c) => (
              <Link
                key={c.id}
                href={`/utforsk?category=${c.id}`}
                className="category-card"
                onClick={() => track("category_opened", { category: c.id })}
              >
                <span className={`category-icon category-${c.id}`}>
                  <CategoryIcon name={c.icon} size={31} />
                </span>
                <strong>{c.name}</strong>
                <span>
                  Se mulighetene <ArrowUpRight size={13} />
                </span>
              </Link>
            ))}
          </div>
          <p className="section-footnote">
            Populært i Steigen · Utvalgte eksempler, ikke faktisk
            bruksstatistikk.
          </p>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TIL HELGEN, HAGEN ELLER HYTTETUREN</p>
            <h2>Du trenger ikke eie alt.</h2>
          </div>
          <Link href="/utforsk" className="text-link">
            Finn din neste mulighet <ArrowRight size={17} />
          </Link>
        </div>
        <div className="listing-grid">
          {[
            demoListings[6],
            demoListings[9],
            demoListings[16],
            demoListings[15],
          ].map((l) => (
            <ListingCard listing={l} key={l.id} />
          ))}
        </div>
      </section>
      <section className="container delivery-section">
        <div className="delivery-art" aria-hidden="true">
          <div className="art-sun" />
          <svg viewBox="0 0 460 240" fill="none">
            <path
              d="m0 200 95-76 45 33 62-102 81 111 48-55 129 89"
              fill="#c3d3c1"
            />
            <path
              d="m0 216 76-50 46 29 113-81 84 73 61-30 80 59"
              fill="#9eb7a4"
            />
            <path
              d="M22 216h414"
              stroke="#174d3c"
              strokeWidth="2"
              strokeDasharray="6 8"
            />
            <path
              d="M83 122h150v78H83z"
              fill="#f9f3e5"
              stroke="#174d3c"
              strokeWidth="2.5"
            />
            <path
              d="M233 149h43l27 27v24h-70z"
              fill="#d5b87f"
              stroke="#174d3c"
              strokeWidth="2.5"
            />
            <path
              d="M247 157h24l19 19h-43z"
              fill="#eaf3eb"
              stroke="#174d3c"
              strokeWidth="2"
            />
            <circle cx="118" cy="201" r="16" fill="#174d3c" />
            <circle cx="118" cy="201" r="6" fill="#f6edda" />
            <circle cx="271" cy="201" r="16" fill="#174d3c" />
            <circle cx="271" cy="201" r="6" fill="#f6edda" />
            <path
              d="m139 157 10 10 22-24"
              stroke="#174d3c"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="m327 163 34-29 34 29v42h-68z"
              fill="#bd7257"
              stroke="#174d3c"
              strokeWidth="2"
            />
            <path
              d="M350 180h16v25"
              fill="#efe7d8"
              stroke="#174d3c"
              strokeWidth="2"
            />
          </svg>
          <span className="art-label">
            <Truck size={15} />
            Litt enklere, hele veien hjem.
          </span>
        </div>
        <div className="delivery-copy">
          <span className="eyebrow">EN LITEN EKSTRA HJELP</span>
          <h2>
            Ikke plass i bilen?
            <br />
            Kanskje naboen kan levere.
          </h2>
          <p>
            Noen ting er litt store å hente selv. På Lånndet vil utleiere kunne
            tilby levering, mot et avtalt tillegg.
          </p>
          <Link
            className="text-link"
            href="/utforsk?delivery=1"
            onClick={() =>
              track("delivery_interest_clicked", { source: "home" })
            }
          >
            Se eksempler med levering <ArrowRight size={17} />
          </Link>
          <span className="fine-print">
            Planlagt funksjon · pris og område avtales med utleier.
          </span>
        </div>
      </section>
      <section className="container section how-section" id="slik-fungerer-det">
        <div className="center-heading">
          <p className="eyebrow">IKKE MER KOMPLISERT ENN DET</p>
          <h2>Slik fungerer Lånndet</h2>
          <p>En god avtale begynner med noen i nærheten.</p>
          <div
            className="segmented"
            role="group"
            aria-label="Slik fungerer det for"
          >
            <button
              className={role === "rent" ? "selected" : ""}
              aria-pressed={role === "rent"}
              onClick={() => setRole("rent")}
            >
              Jeg vil leie
            </button>
            <button
              className={role === "owner" ? "selected" : ""}
              aria-pressed={role === "owner"}
              onClick={() => setRole("owner")}
            >
              Jeg vil leie ut
            </button>
          </div>
        </div>
        <div className="steps-grid">
          {(role === "rent"
            ? [
                [
                  "Finn det du trenger",
                  "Utforsk ting i nærheten og finn det som passer.",
                ],
                [
                  "Send en forespørsel",
                  "Velg tidspunkt og ta kontakt med utleieren.",
                ],
                [
                  "Hent eller få levert",
                  "Avtal det praktiske på en måte som passer begge.",
                ],
                [
                  "Bruk og lever tilbake",
                  "Få jobben gjort, og lever utstyret pent tilbake.",
                ],
              ]
            : [
                [
                  "Legg ut det du har",
                  "La det som står ubrukt i boden komme til nytte.",
                ],
                [
                  "Velg pris og tidspunkt",
                  "Du bestemmer når tingene dine kan leies.",
                ],
                [
                  "Godkjenn forespørselen",
                  "Bli enige om henting eller levering.",
                ],
                [
                  "Tjen litt på det du eier",
                  "Gi tingene mer bruk – og deg litt ekstra.",
                ],
              ]
          ).map(([title, text], i) => (
            <div className="how-step" key={title}>
              <span className="step-number">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <p className="section-footnote centered">
          Slik planlegger vi at tjenesten skal fungere ved lansering.
        </p>
      </section>
      <section className="community-section">
        <div className="container community-inner">
          <div className="community-image">
            <Image
              src="/images/hero.webp"
              fill
              sizes="(max-width:700px) 100vw, 45vw"
              alt="Generert naust og utstyr ved en nordnorsk fjord"
            />
            <div className="community-stamp">
              <Logo symbol />
              <span>
                LOKALT ER
                <br />
                LITT FINERE.
              </span>
            </div>
          </div>
          <div className="community-copy">
            <p className="eyebrow">STARTER LOKALT I STEIGEN</p>
            <h2>
              Det beste vi har,
              <br />
              er hverandre.
            </h2>
            <p>
              Det står sannsynligvis en høytrykksspyler ubrukt i nærheten. Og
              kanskje har du noe noen andre trenger.
            </p>
            <p>
              Fra Leinesfjord til Engeløya. Jo flere vi er, desto mer kan vi
              dele lokalt.
            </p>
            <Link href="/ny-annonse" className="button primary">
              Hva har du i boden? <Plus size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section className="container section trust-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GODE AVTALER TRENGER TRYGGHET</p>
            <h2>Trygt å leie lokalt.</h2>
          </div>
          <span className="pill">Under utvikling</span>
        </div>
        <div className="trust-grid">
          {[
            [
              KeyRound,
              "Vit hvem du leier av",
              "Vi planlegger BankID-verifisering av brukere.",
            ],
            [
              CreditCard,
              "En ryddig betaling",
              "Vi planlegger enkel betaling med Vipps ved lansering.",
            ],
            [
              ShieldCheck,
              "Tydelige rammer",
              "Leievilkår, depositum og eventuell forsikring avklares før lansering.",
            ],
            [
              MessageCircle,
              "Erfaringer som hjelper",
              "Vurderinger og rapportering skal bidra til gode avtaler.",
            ],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof KeyRound;
            return (
              <div className="trust-item" key={String(title)}>
                <I size={25} strokeWidth={1.5} />
                <h3>{String(title)}</h3>
                <p>{String(text)}</p>
                <span className="planned-label">Planlagt funksjon</span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="container research-cta">
        <div className="research-cta-icon">
          <HeartHandshake size={45} strokeWidth={1.2} />
        </div>
        <div>
          <p className="eyebrow">DIN MENING BETYR NOE</p>
          <h2>Kunne du tenke deg å låne litt mer?</h2>
          <p>
            Hjelp oss å lage noe Steigen faktisk får bruk for. To minutter er
            nok.
          </p>
        </div>
        <button
          className="button cream"
          onClick={() => open({ type: "survey" })}
        >
          Si hva du synes <ArrowUpRight size={18} />
        </button>
      </section>
      <section className="container section faq-section">
        <div>
          <p className="eyebrow">LURER DU PÅ NOE?</p>
          <h2>Godt å vite.</h2>
          <p>
            Vi er tidlig i løypa.
            <br />
            Her er det vi vet så langt.
          </p>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <Plus size={19} />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
