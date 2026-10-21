import Link from "next/link";
import { SearchX, ArrowRight } from "lucide-react";
export default function NotFound() {
  return (
    <div className="container empty-page">
      <SearchX size={50} strokeWidth={1.3} />
      <p className="eyebrow">HER VAR DET TOMT</p>
      <h1>Denne siden fant vi ikke.</h1>
      <p>Men det er mye annet du kan finne i nabolaget.</p>
      <Link className="button primary" href="/utforsk">
        Utforsk annonsene <ArrowRight size={17} />
      </Link>
    </div>
  );
}
