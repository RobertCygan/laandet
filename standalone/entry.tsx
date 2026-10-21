import { createRoot } from "react-dom/client";
import { useEffect, Component, type ReactNode } from "react";
import { MapPin, ShieldCheck, Star, MessageCircle } from "lucide-react";
import assets from "standalone:assets";
import { IntroGate } from "@/components/layout/IntroGate";
import { Home } from "@/components/Home";
import { Explore } from "@/components/listings/Explore";
import { ListingDetail } from "@/components/listings/ListingDetail";
import { CategoryDirectory } from "@/components/listings/CategoryDirectory";
import { ListingWizard } from "@/components/forms/ListingWizard";
import { InfoPage } from "@/components/InfoPage";
import { Dashboard } from "@/components/research/Dashboard";
import { ResearchProvider } from "@/components/research/ResearchProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageTracker } from "@/components/layout/PageTracker";
import { ListingCard } from "@/components/listings/ListingCard";
import NotFound from "@/app/not-found";
import { demoListings, demoWanted, demoOwners } from "@/data/demoListings";
import { infoSlugs, infoTitles } from "@/data/info";
import { useOfflineLocation } from "./adapters";
function Profile({ id }: { id: string }) {
  const owner = demoOwners.find((o) => o.id === id);
  if (!owner) return <NotFound />;
  return (
    <div className="container profile-page">
      <div className="profile-header">
        <div className="profile-avatar">{owner.displayName[0]}</div>
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
              <ListingCard key={l.id} listing={l} />
            ))}
        </div>
      </section>
    </div>
  );
}
function OfflineApp() {
  const location = useOfflineLocation();
  const [route, anchor] = location.split("#");
  const [pathname, search = ""] = route.split("?");
  const query = Object.fromEntries(new URLSearchParams(search));
  let content: ReactNode;
  let title = "Lånndet – lei ting av folk i nærheten";
  if (pathname === "/") content = <Home />;
  else if (pathname === "/utforsk") {
    content = <Explore key={route} initial={query} />;
    title = "Utforsk nabolaget | Lånndet";
  } else if (pathname === "/kategorier") {
    content = <CategoryDirectory />;
    title = "Alle kategorier | Lånndet";
  } else if (pathname === "/ny-annonse") {
    content = (
      <ListingWizard key={route} initialType={query.type ?? "rental"} />
    );
    title = "Lag en demoannonse | Lånndet";
  } else if (pathname === "/research") {
    content = <Dashboard />;
    title = "Lokalt researchpanel | Lånndet";
  } else if (pathname.startsWith("/annonse/")) {
    const id = pathname.slice("/annonse/".length);
    const listing = [...demoListings, ...demoWanted].find((l) => l.id === id);
    content = listing ? (
      <ListingDetail key={id} listing={listing} />
    ) : (
      <NotFound />
    );
    title = listing
      ? listing.title + " – demo | Lånndet"
      : "Siden finnes ikke | Lånndet";
  } else if (pathname.startsWith("/profil/")) {
    content = <Profile id={pathname.slice("/profil/".length)} />;
    title = "Eksempelprofil | Lånndet";
  } else if (infoSlugs.includes(pathname.slice(1))) {
    content = <InfoPage page={pathname.slice(1)} />;
    title = infoTitles[pathname.slice(1)] + " | Lånndet";
  } else content = <NotFound />;
  useEffect(() => {
    document.title = title;
    const timer = window.setTimeout(() => {
      if (anchor) document.getElementById(anchor)?.scrollIntoView();
      else window.scrollTo(0, 0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location, anchor, title]);
  return (
    <IntroGate
      sources={{
        webm: assets["/videos/intro.webm"],
        mp4: assets["/videos/intro.mp4"],
      }}
    >
      <ResearchProvider>
        <a
          className="skip-link"
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("main")?.focus();
          }}
        >
          Hopp til innhold
        </a>
        <Header />
        <main id="main" tabIndex={-1}>
          {content}
        </main>
        <Footer />
        <PageTracker />
      </ResearchProvider>
    </IntroGate>
  );
}
class OfflineBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="container empty-page">
        <h1>Noe gikk ikke helt som det skulle.</h1>
        <p>Åpne filen på nytt eller tilbakestill lokale demodata.</p>
        <button
          className="button primary"
          onClick={() => {
            Object.keys(localStorage)
              .filter((key) => key.startsWith("laanndet:"))
              .forEach((key) => localStorage.removeItem(key));
            window.location.hash = "/";
            window.location.reload();
          }}
        >
          Tilbakestill demoen
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <OfflineBoundary>
    <OfflineApp />
  </OfflineBoundary>,
);
