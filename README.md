# Lånndet

## Pobierz i otwórz — bez instalacji

[Pobierz gotowy HTML w ZIP](https://github.com/RobertCygan/laandet/raw/refs/heads/main/Laanndet.zip). Rozpakuj archiwum i otwórz `Laanndet.html` dwukrotnym kliknięciem. Najpierw uruchomi się animacja G-PSI, a potem demonstracja Lånndet. Wszystkie zdjęcia, animacja i funkcje demonstracji są zawarte w jednym pliku; działa bez internetu.

Możesz też pobrać sam plik [Laanndet.html](https://github.com/RobertCygan/laandet/blob/main/Laanndet.html), wybierając na GitHubie **Download raw file**. Gotowe pliki znajdują się w głównym katalogu repozytorium. Aby odtworzyć HTML z kodu, uruchom `npm ci`, a następnie `npm run export:html -- --output Laanndet.html`.

Ankiety i inne dane zapisują się wyłącznie w przeglądarce osoby oglądającej demonstrację. Nie trafiają do wspólnej bazy.

A complete, Norwegian Bokmål, web-only research MVP for a hyperlocal peer-to-peer rental marketplace. It starts in Steigen, Nordland, with a municipality/local-area/postcode/approximate-coordinate model that can expand geographically.

**This is a transparent market-validation application, not an operating rental service.** All 18 offers, 5 wanted listings, 4 profiles and equipment images are fictional and labelled. There are no real bookings, payments, insurance, identity checks, reviews or messages.

## One HTML file — no installation or hosting

A portable edition contains the same interactive demo in **one self-contained HTML file**, including all 18 equipment images, the coastal hero, the user-provided G-PSI logo intro (WebM and MP4), font, styles, React, routing, survey, listing wizard and local research tools. Open `out/Laanndet.html` directly in a browser by double-clicking it. There are no external requests or required servers. Navigation stays inside the file using `#/` routes. Research responses remain local to that file/browser; they are not sent to the team. The share button explains that the file itself must be shared rather than a local file address.

To regenerate it from source:

```sh
npm ci
npm run export:html
```

An alternative output path can be selected with `npm run export:html -- --output /path/to/Laanndet.html`. The exporter reuses the application components and data, with small browser adapters for links, images and routing; it does not replace the Next.js app. Its embedded Content Security Policy blocks network connections. `npm test` regenerates the file before running the suites; the standalone tests open a real `file://` URL with the browser network disabled. The exported file requires JavaScript enabled in a modern browser. The original seven-second intro plays once on document opening, then fades into Lånndet. Internal navigation does not replay it. A skip button or Escape bypasses it; reduced-motion preferences skip it automatically. Both video formats are embedded, so the complete file is approximately 8.35 MB.

## Run

Use **Node.js 24 LTS** and npm (the prepared cloud machine uses Node 24.19.0). No secrets or external services are needed.

```sh
npm install
npm run dev
```

Next serves port 3000. For reproducible dependency installation use `npm ci`. The project-local npm cache is ignored by Git. To change the port, use `npm run dev -- --port 3001`.

Production:

```sh
npm run build
npm start
```

Checks:

```sh
npm run lint
npm run typecheck
npm test
```

`npm test` runs Playwright against an already running server on port 3000, or starts the development server automatically. To validate production, build and run `npm start` before running the tests. The suite exercises actual browser interactions, screenshots at 360/390/430/768/1024/1440/1920 pixels, and axe accessibility checks. Reports are generated in `playwright-report/`, with screenshots and failure traces in `test-results/`.

On Linux, the test wrapper prefers the prepared full Chrome in `/workspace/.cache/google-chrome`, then an installed system Chrome/Chromium. `npm run browser:install` installs the optional full browser in that cloud cache without system writes. It verifies Google’s fingerprint-pinned repository signing key, Release signature, package-index SHA256 and package SHA256 before extraction. The package-manager network preset already permits `dl.google.com`; no wider network policy is required. Without a full browser, the wrapper falls back to the integrity-checked `@sparticuz/chromium` npm package; that serverless build can be less reliable when repeatedly creating contexts. On macOS/Windows or if using a regular installed Chrome, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. `npm run test:ui` opens Playwright UI when a graphical environment is available. `npm run format` formats the source. With the production server running and no other browser work in progress, `npm run audit:lighthouse` writes mobile/desktop reports to `reports/`.

## Technology and structure

Next.js 16.4.2 App Router, React 19.3.1, strict TypeScript, Tailwind CSS 4 with a custom token-based CSS design system, local Manrope fonts, Lucide icons, Next Image, Playwright and axe. Server components handle layouts, routing, metadata, static listing/profile generation and not-found responses. Client components own interactions. Research and domain types are independent of rendering.

```text
app/
  page.tsx                  # Marketplace home
  utforsk/                  # Search, filters, list/map modes
  kategorier/               # All 19 illustrated categories
  annonse/[id]/             # 18 offer + 5 wanted detail routes
  ny-annonse/               # Five-step demo wizard
  profil/[id]/              # Four clearly fictional profiles
  research/                # Local-only research dashboard, noindex
  [page]/                  # About, safety, privacy, terms, contact
  layout.tsx               # Metadata, brand shell, research context
  globals.css              # Tokens, components, responsive rules
  icon.svg, robots.ts
components/
  layout/                  # Header, footer, page tracking
  listings/                # Cards, catalog, details, illustrative map
  forms/                   # Listing wizard
  research/                # Accessible dialogs, survey, privacy, dashboard
  Home.tsx, InfoPage.tsx, Icon.tsx
data/
  demoListings.ts           # Fictional inventory, owners, wanted listings
  categories.ts             # 19 categories + initial local areas
lib/
  config.ts                 # RESEARCH_MODE, storage keys, NOK units
  research.ts               # Local event/persistence/export adapter
types/                     # Domain and research interfaces
public/images/              # Original generated WebP images and provenance
scripts/                    # Test/audit runners + verified optional browser installer
tests/marketplace.spec.ts   # Browser acceptance and accessibility suite
```

## Implemented

- Original green/sand brand, logo, favicon, locally hosted type and original generated coastal hero/equipment photos. A calm consumer marketplace layout, not a dashboard-style homepage.
- Equal treatment of **Til leie** and **Ønskes leid**, Norwegian search, 19 category filters, area/price/unit/date filters, delivery and saved favorites, sorting, empty states and approximate interactive map markers.
- Detail views with image lightbox, included equipment, rules, owner profile, duration prices/discounts, delivery price calculation and a demonstrative calendar. No exact private addresses.
- A validated five-step listing wizard for both offers and requests: category, text, up to five local image previews, hourly/daily/weekend/weekly prices or wanted budget, delivery, area/postcode, dates, preview, local draft save/restore and explicit non-public completion.
- An accessible native-dialog nine-question survey. Multiple categories/priorities, optional free text, optional email or phone, optional-contact validation and consent. Contact details are never required to answer.
- Research intent prompts, optional launch-interest capture, accessible mobile menu, keyboard handling, reduced-motion support, footer/legal information and planned-safety disclosures.
- Local-only research dashboard, event table, category/location/delivery/distance/intent charts, event-based funnel and JSON export. Charts start empty and use actual local activity, not fabricated metrics.
- Privacy controls to stop local event tracking, export and delete local data. No advertising trackers, fingerprinting, cross-site analytics or cookies.

## Routes

| Route                                                    | Purpose                                                                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`                                                      | Complete marketplace homepage                                                                                          |
| `/utforsk`                                               | Discovery; query parameters `q`, `type=wanted`, `category`, `location`, `delivery=1`, `favorites=1` initialize filters |
| `/annonse/hoytrykksspyler`                               | Example rental detail; 23 demo detail slugs in total                                                                   |
| `/annonse/minigraver`                                    | Example wanted detail                                                                                                  |
| `/ny-annonse`                                            | Offer wizard; `?type=wanted` starts a wanted draft                                                                     |
| `/profil/owner-0`                                        | Fictional owner profile; IDs 0–3                                                                                       |
| `/om`, `/trygghet`, `/personvern`, `/vilkar`, `/kontakt` | Informational pages                                                                                                    |
| `/research`                                              | Local research dashboard, intentionally absent from navigation and excluded from indexing                              |

Unknown listing/profile/page slugs return a proper 404.

## Research mode and data

`RESEARCH_MODE = true` lives in `lib/config.ts`. Research actions lead to intent questions, not transaction endpoints. **Changing this flag does not magically enable a real marketplace**: authentication, authorization, trusted availability, booking, payments and all server services must be implemented separately before real use.

Every seeded offer includes `isDemo: true`, listing type, title, description, category, location, municipality, postcode, approximate coordinates, optional duration prices, delivery option/price, original image, creation date, availability and fictional owner reference. Wanted content is a separate typed array. Domain interfaces cover User, Listing, WantedListing, Category, Location, Availability, RentalRequest, Conversation, Message, Favorite, Review, Payment, DeliveryOption and ResearchResponse.

The event adapter records:

`page_view`, `search_performed`, `category_opened`, `listing_opened`, `wanted_listing_opened`, `rent_cta_clicked`, `have_this_clicked`, `delivery_interest_clicked`, `create_listing_started`, `create_listing_completed_demo`, `survey_started`, `survey_completed`, `launch_interest`.

Events contain a random **event** ID, timestamp, name and relevant category/area/price/source fields. There is no stable visitor ID. Intent opening and answering are distinct records; the dashboard uses `stage: opened` for rental CTA counts. Counts are not unique people, and repeated clicks can make event ratios exceed 100%.

### Important limitation for field research

**Research answers, launch-interest contacts and drafts stay only in that browser's localStorage. They are not sent to the team. A participant is not subscribed to a real launch notification.** This is explained before and after submission. For a moderated local study, a participant can explicitly export the local JSON and choose whether to share it. `/research` aggregates only the current browser and is not a secure admin system; hiding its link and `noindex` are not authentication.

There is no synthetic analytics fixture. Empty charts remain empty until someone interacts. Local research keys use the `laanndet:*:v1` namespace; the event log retains the last 1,500 entries. Survey answers and contacts remain until explicitly deleted or browser storage is cleared. Uploaded draft images are memory-only object URLs and disappear on reload; image bytes are never uploaded or stored in localStorage. Draft text/prices/location can be restored.

A production research phase should replace the `lib/research.ts` persistence adapter with a validated, rate-limited server API, access-controlled database, explicit retention and consent rules, plus protected aggregate reporting. Never forward contact data to a public analytics tool.

## Images and performance

All images are project-generated, local WebP exports. Logo, delivery artwork, empty-state icons and approximate map artwork are original vectors. See `public/images/README.md`. No remote image or font requests are required. Next Image sizes/lazy loading are configured; only above-fold hero/detail images are prioritized. Equipment pictures are single fictional views; the lightbox does not fabricate extra angles. The calendar is an explicit example (October 24–25, 2026 are unavailable), with no booking backend.

The design targets Lighthouse Performance >90, Accessibility >95, Best Practices >95, SEO >90. Automated axe results do not establish full WCAG compliance; keyboard, visual layout and screen-reader reviews are separate concerns. Actual measured results and any limitations are recorded in `VALIDATION.md`.

## Configuration and deployment

No required environment variables. Optional `NEXT_PUBLIC_SITE_URL` should be your real public HTTPS origin; see `.env.example`. Vercel's production hostname is used automatically if supplied. Without a configured public hostname, no made-up canonical domain or social-image URL is emitted. Site metadata, Norwegian locale, local favicon, WebSite JSON-LD and robots rules are prepared; add a canonical-domain sitemap when the final domain is known.

Deploy to Vercel:

1. Push this project to your GitHub repository and import it in Vercel.
2. Select Next.js and Node 24, with this directory as the root.
3. Use install `npm ci`, build `npm run build` and default Next output settings.
4. Set `NEXT_PUBLIC_SITE_URL` to the real domain if needed. No database, API keys or payment settings are necessary for this local-persistence demo.
5. Deploy, verify the major routes on the deployed host, then test consent/export behavior on a phone. Data is isolated per browser and origin.

An equivalent Node host can run `npm ci`, `npm run build` and `npm start`, behind its HTTPS reverse proxy. Deployment and Git pushing are not performed automatically by this repository.

## Next phase

1. Conduct moderated tests in Steigen and collect explicitly shared exports, or implement a real research backend before inviting unmoderated traffic.
2. Establish the responsible business/contact address, privacy basis, retention and legal terms; current text is an original research-stage placeholder.
3. Add authenticated profiles, protected administration, actual inventory and moderation/reporting.
4. Design trusted availability, conversations and rental agreements; determine liability, deposit and insurance rules.
5. Integrate BankID and payments only after provider agreements and appropriate security review. No current partnership or insurance is implied.

### Saving from a cloud HTML preview

The export includes a preview-only Polish `Zapisz HTML` button at the lower left, shown after the intro. It creates a browser-local Blob download without calling the cloud artifact-download endpoint. Saved copies retain all embedded assets and application code, and omit the export controls, rendered UI state and browser research data. The adjacent `⋯` menu offers `Kopiuj kod HTML`; when clipboard access is unavailable, it opens a preselected plain-text field for manual copying into an UTF-8 `.html` file. A host iframe may prohibit downloads, so this is an alternative mechanism, not a guarantee about the chat interface's download permissions.
