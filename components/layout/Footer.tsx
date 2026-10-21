"use client";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Logo } from "@/components/Icon";
import { useResearch } from "@/components/research/ResearchProvider";
export function Footer() {
  const { open } = useResearch();
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link href="/" aria-label="Lånndet – hjem">
            <Logo />
          </Link>
          <p>
            Mer bruk. Mindre kjøp.
            <br />
            Litt nærmere hverandre.
          </p>
          <span className="footer-local">
            <MapPin size={14} /> Skapt for lokalmiljøet i Steigen
          </span>
        </div>
        <div>
          <h3>Lånndet</h3>
          <Link href="/om">Om Lånndet</Link>
          <Link href="/#slik-fungerer-det">Slik fungerer det</Link>
          <Link href="/trygghet">Trygghet</Link>
        </div>
        <div>
          <h3>Greit å vite</h3>
          <Link href="/personvern">Personvern</Link>
          <Link href="/vilkar">Vilkår</Link>
          <Link href="/kontakt">Kontakt</Link>
        </div>
        <div>
          <h3>Vi bygger dette sammen</h3>
          <p>Hva ville gjort hverdagen din enklere?</p>
          <button
            className="footer-feedback"
            onClick={() => open({ type: "survey" })}
          >
            Gi tilbakemelding <ArrowUpRight size={17} />
          </button>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Lånndet</span>
        <span>
          Lånndet er i en tidlig testfase. Alle annonser er eksempler.
        </span>
        <span>Heia det lokale.</span>
      </div>
    </footer>
  );
}
