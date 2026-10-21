"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Menu, X, MapPin, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/Icon";
import { useResearch } from "@/components/research/ResearchProvider";
export function Header() {
  const { open } = useResearch();
  const [menu, setMenu] = useState(false);
  const path = usePathname();
  useEffect(() => {
    if (!menu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);
  return (
    <>
      <div className="topbar">
        <span>
          <MapPin size={12} /> Starter lokalt i Steigen
        </span>
        <button onClick={() => open({ type: "survey" })}>
          Sammen gjør vi mer av det vi har <ArrowUpRight size={13} />
        </button>
      </div>
      <header className="header">
        <div className="nav-shell">
          <button
            className="icon-button menu-button"
            aria-label={menu ? "Lukk meny" : "Åpne meny"}
            aria-expanded={menu}
            aria-controls="mobile-menu"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <Link
            className="logo-link"
            href="/"
            aria-label="Lånndet – hjem"
            onClick={() => setMenu(false)}
          >
            <Logo />
          </Link>
          <nav className="desktop-nav" aria-label="Hovedmeny">
            <Link
              className={path === "/utforsk" ? "active" : ""}
              href="/utforsk"
            >
              Utforsk
            </Link>
            <Link href="/#kategorier">Kategorier</Link>
            <Link href="/utforsk?type=wanted">Ønskes leid</Link>
            <Link href="/#slik-fungerer-det">Slik fungerer det</Link>
          </nav>
          <div className="nav-actions">
            <button
              className="login-button"
              onClick={() => open({ type: "login" })}
            >
              Logg inn
            </button>
            <Link
              className="button primary nav-create"
              href="/ny-annonse"
              aria-label="Legg ut annonse"
            >
              <Plus size={18} />
              <span>Legg ut annonse</span>
            </Link>
          </div>
        </div>
        {menu && (
          <nav className="mobile-menu" id="mobile-menu" aria-label="Mobilmeny">
            {[
              ["Utforsk", "/utforsk"],
              ["Kategorier", "/#kategorier"],
              ["Ønskes leid", "/utforsk?type=wanted"],
              ["Slik fungerer det", "/#slik-fungerer-det"],
              ["Mine favoritter", "/utforsk?favorites=1"],
            ].map(([text, href]) => (
              <Link href={href} key={text} onClick={() => setMenu(false)}>
                {text}
                <ArrowUpRight size={18} />
              </Link>
            ))}
            <button
              onClick={() => {
                setMenu(false);
                open({ type: "login" });
              }}
            >
              Logg inn <ArrowUpRight size={18} />
            </button>
          </nav>
        )}
      </header>
    </>
  );
}
