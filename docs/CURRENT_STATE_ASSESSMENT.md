# Current State Assessment (Phase 00 inventory)

**Date:** 25.10.2026
**Scope:** Everything in `RobertCygan/G-PSI_WWW` on branch `main` at commit `d879a55`.
**Method:** Read the files, unpacked the embedded assets of the prototype, and rendered every prototype route in Chromium (Playwright) at 1280 px and 390 px width.

## 1. What is in the repository

| Path | What it is | Relevance to Laandet |
|---|---|---|
| `Laanndet.html` (8.8 MB) and the identical copy `www/public/prosjekter/Laanndet.html` | The Laandet visual prototype. One self-contained HTML file with a bundled React app, the Manrope font, 19 AI-generated images and the G-PSI intro video embedded as base64. | **Primary design source.** |
| `www/` | The G-PSI.ai company website: TanStack Start, React 19, Tailwind CSS 4, Better Auth, Kysely, PGlite/Postgres, deployed with a Vercel preset. Auth federates to an external "Grok auth broker". | Shows the owner's existing tooling, but this is a different product and should not be reused (see §4). |
| `index.html`, `gpsi-logo.html`, `intro.mp4`, `gpsi-logo.jpg` | G-PSI site export, logo animation. | Not related to Laandet. |
| `kalkulator.html`, `simulator.html`, `eiendomsskatt.html`, `utgiftsanalyse.html`, `tools/` | Other G-PSI demos (municipal finance). | Not related. |
| `CZYTAJ.txt` | Notes (Polish). Lists `Laanndet.html` as "koncept, przykładowe ogłoszenia". | Confirms the prototype is a concept with sample listings. |

There is **no source code** for the prototype in the repository, only the compiled bundle. The design
therefore has to be carried over from the extracted CSS, the images and the screenshots, not by
reusing React components.

## 2. The prototype, screen by screen

Routes are hash-based (`#/...`). Every route was rendered and its text captured.

| Route | Content | Works? |
|---|---|---|
| `#/` Home | Intro logo film (skippable), hero with "Lei det du trenger. Lån bort det du har.", search bar with locality picker (Hele Steigen, Leinesfjord, Leines, Nordfold, Engeløya, Nordskot, Bogøy, Helnessund, Bogen), example listing grids, category tiles, a delivery teaser, a "Slik fungerer det" four-step block, a trust block (BankID, Vipps, rules, reviews all marked *Planlagt funksjon*), a feedback call-to-action and an FAQ. | Static. Search and filters only filter the built-in demo array. |
| `#/utforsk` | Explore page: Til leie / Ønskes leid tabs, list/map toggle, filters (category, area, delivery). | Client-side filtering of demo data. The map toggle shows no real map data. |
| `#/annonse/:id` | Listing detail: "Demoannonse" badge, title, approximate area, save/share, image with "KI-generert eksempelbilde" caption, price by unit (time/dag/helg/uke), included accessories, rules, pickup/delivery block ("Kan leveres · +150 kr"), sample availability calendar. | Static. The calendar only highlights a chosen date; nothing can be booked. |
| `#/ny-annonse` | Five-step listing wizard: 1 Hva vil du dele? (Jeg vil leie ut / Jeg ønsker å leie, category) → 2 Fortell litt mer → 3 Pris og praktisk → 4 Sted og tidspunkt → 5 Forhåndsvisning. | Draft is saved to `localStorage` only. Nothing is published. |
| `#/kategorier` | 19 category tiles. | Links to filtered explore page. |
| `#/trygghet`, `#/om`, `#/vilkar`, `#/personvern`, `#/kontakt` | Honest early-stage texts: no BankID, no Vipps integration, no insurance, no real contact address, data stays in the browser. | Static text. `#/personvern` can export or delete local data. |
| `#/profil/:id` | Example owner profiles (Ola N., Ingrid H., Marius L., Anne K.). | Fictional, marked as examples. |
| Survey modal | Nine-question research survey; answers stored only in `localStorage`. | Works locally. |

### What actually works today

- Rendering, navigation and client-side filtering of **fictional** data.
- A listing draft and a survey, both saved **only in the visitor's browser**.
- Export/delete of the local data.

### What does not exist

Accounts, login, a server, a database, publishing, messaging, booking, agreements, condition
reports, disputes, reviews, moderation, email, payments, image upload, real search, maps.

### Good practices already present (keep them)

- Every demo listing, image and profile is labelled as an example ("Demoannonse",
  "KI-generert eksempelbilde", "Eksempelprofil").
- Planned features are labelled as planned ("Planlagt funksjon"), and the texts openly say that BankID,
  Vipps, insurance and real contact details do not exist yet.
- Only approximate areas are shown ("omtrentlig område"). Exact pickup places are not shown.
- A strict Content-Security-Policy (`default-src 'none'`, no network access).
- Accessibility basics: skip link, visible focus ring (`#bd8c38`), labelled form fields, `aria-pressed` on toggles.
- No tracking pixels or third-party requests.

### Problems to fix during migration

| # | Problem | Fix |
|---|---|---|
| P1 | The UI says **"Lånndet"** and the file name says **"Laanndet"**. The official name is **Laandet**. | Use "Laandet" in all new code, text and assets. The wordmark is text plus an icon, so it is easy to change. |
| P2 | Trust texts promise "enkel betaling med Vipps ved lansering". The MVP will not integrate payments (master spec §10). | Change to: payments are arranged directly between the parties, and Laandet does not handle money. |
| P3 | Categories "Bil og transport" and "Båt og sjø" conflict with the restricted-items policy (no motor vehicles or motorboats in the MVP). | Narrow them to "Transporttilbehør" (roof boxes, racks) and "Kajakk, kano og SUP" (non-motorised only). See `PROHIBITED_ITEMS.md`. |
| P4 | A chainsaw ("Kraftig motorsag") and a scaffold ("Aluminium rullestillas") are demo listings. | Allowed, but in the *restricted* tier with mandatory safety confirmations. |
| P5 | Demo listings have no declared item value, which the new contract logic requires. | Seeds must add declared values before demo data is reused. |
| P6 | Body text is 9–12 px in several places (`.topbar` 9 px, `.hero-benefits` 9 px, `.local-pill` 8 px, `.image-disclaimer` 7 px). | Raise the minimum to 12 px (and 16 px for form inputs, so iOS does not zoom) while keeping the look. |
| P7 | "Lagre" (save) on listings uses `localStorage`. | Becomes a server-side "saved listings" feature (Phase 01, optional). |
| P8 | The map view has no real map. | Leave maps out of the MVP. Use locality filters instead (no invented distances). |
| P9 | The intro logo film adds 5 MB and delays the first view. | Drop it from Laandet. It belongs to the G-PSI brand site. |

## 3. Reusable design assets (extracted to `laandet/design/prototype/`)

| Asset | File | Notes |
|---|---|---|
| Design tokens and full stylesheet | `prototype.css` (85 kB, fonts removed) | Colours, radii, shadows, spacing, components (`.button`, `.pill`, cards, hero, header, footer, wizard, calendar). |
| Favicon / app mark | `favicon.svg` | Two-arrow "exchange" symbol on deep green `#174d3c`. |
| Hero image | `images/hero.webp` | AI-generated Nordland fjord with a red boathouse, kayak and garden tools. Must keep the "Illustrasjonsbilde · KI-generert" caption. |
| 18 product photos | `images/equipment-1.webp` … `equipment-18.webp` | AI-generated. Usable only for clearly labelled example listings. Mapping is in `demo-content.json`. |
| Demo content | `demo-content.json` | 18 rental and 5 wanted example listings, 19 categories, 8 localities, prices converted to øre. |
| Font | Manrope (SIL Open Font License 1.1) | Install from `@fontsource-variable/manrope`. Do not commit font files. |

Design tokens (from `:root` of the prototype):

| Token | Value | Use |
|---|---|---|
| `--background` | `#fcfbf8` | Warm white page background |
| `--surface` | `#f2f3ed` | Section background |
| `--surface-elevated` | `#ffffff` | Cards |
| `--primary` | `#174d3c` | Deep Nordic green: brand, primary buttons |
| `--primary-hover` | `#103c2e` | |
| `--secondary` | `#e7eee6` | Subtle buttons, pills |
| `--accent` | `#d9ba83` | Warm sand accent |
| `--text` | `#253b32` | Body text |
| `--text-muted` | `#596650` | Secondary text |
| `--border` | `#e2e5dc` | |
| `--success` / `--warning` / `--danger` | `#245d42` / `#87631d` / `#a33d36` | Status colours |
| `--radius` | `12px` | Cards; buttons use 7 px |
| `--shadow` | `0 8px 32px #23392d08` | Soft card shadow |
| Focus ring | `3px solid #bd8c38` | Keep for accessibility |

## 4. Can the `www/` stack be reused?

The G-PSI website (`www/`) already uses React 19, Tailwind CSS 4, Better Auth and PostgreSQL. That
matches several parts of the master specification. Two of its choices should not be carried over:

1. **Authentication goes through an external "Grok auth broker"** (`GROK_AUTH_ISSUER`) operated
   by the site builder. Laandet must own its own user identities and email verification, with no
   dependency on a third-party broker it does not control.
2. **The scaffolding is tied to that site builder** (preview bridges, PWA middleware, sandbox
   origins), which adds code Laandet does not need.

Conclusion: reuse the **choices** (React, Tailwind 4, Better Auth, PostgreSQL), not the code.
Laandet starts as a clean application in `laandet/app/` (Phase 01). See `DECISIONS.md` D-004.

## 5. Migration path

1. **Phase 00 (this change):** documentation, legal drafts, data model, design assets extracted.
2. **Phase 01:** new Next.js app in `laandet/app/`. Port the design tokens and component styles from
   `prototype.css` into Tailwind theme variables and a few components (header, footer, listing card,
   buttons, pills, form fields, listing wizard). Rebuild the pages one by one with real data.
   Keep the prototype's copy where it is still true, and update it where facts change (P1–P3).
3. Keep `Laanndet.html` in the repository unchanged as the historical prototype until the owner
   decides otherwise. Do not overwrite it.
