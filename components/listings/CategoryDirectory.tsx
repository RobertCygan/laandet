"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categories } from "@/data/categories";
import { CategoryIcon } from "@/components/Icon";
import { track } from "@/lib/research";
export function CategoryDirectory() {
  return (
    <div className="container section category-directory">
      <div className="breadcrumb">
        <Link href="/">Hjem</Link>
        <span>/</span>
        <span>Kategorier</span>
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">HVERDAG, PROSJEKTER OG SMÅ EVENTYR</p>
          <h1>Hva har du bruk for?</h1>
          <p className="muted">19 kategorier. Mange muligheter i nabolaget.</p>
        </div>
      </div>
      <div className="category-grid">
        {categories.map((c) => (
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
              Utforsk kategorien <ArrowUpRight size={13} />
            </span>
          </Link>
        ))}
      </div>
      <p className="section-footnote">
        Alle annonser er eksempler. Finner du ikke det du trenger? Legg ut et
        ønske i demoen.
      </p>
    </div>
  );
}
