# P01-10 — Explore, search, filters and listing detail

## GOAL
Visitors and members find relevant listings quickly, with honest information: no invented distances and no fake
popularity.

## CONTEXT
- Master spec §20 (filters), D-017 (no maps or distances), D-019 (PostgreSQL search), D-024 (demo listings), L-03 (ranking transparency).
- Prototype pages: home, `#/utforsk`, `#/annonse/:id`, `#/kategorier`.

## INPUT
- `listings.search_vector` (Norwegian + simple), trigram index on title, filters, listing images.
- Feature flag `show_demo_listings`.

## OUTPUT
1. **`/utforsk`:**
   - Search box (max 100 characters).
   - Tabs: Leies ut / Ønskes leid / Gis bort.
   - Filters: category, locality ("Hele Steigen" + the localities), price range (Leies ut), delivery option (Hentes / Kan leveres / Møtes), availability date range (Leies ut: excludes blocked periods; from Phase 02 also active bookings).
   - Sort: «Nyeste først» (default) or «Lavest pris».
   - Keyset pagination with 24 items per page.
   - The URL reflects the filters, so the page can be shared.
   - Link «Slik sorterer vi annonsene» to the ranking explanation (brukervilkår §7).
2. **`/gis-bort`:** a shortcut to explore filtered on Gis bort.
3. **`/kategorier`:** category tiles with icons. Prohibited categories are hidden.
4. **Home page** sections from the prototype, filled with real queries:
   - newest Leies ut;
   - newest Ønskes leid;
   - categories;
   - a delivery teaser that only links to listings with delivery.

   When `show_demo_listings` is on, demo listings fill empty slots, always with the «Eksempel» badge. Captions such as "Populært i Steigen" are allowed only when backed by real counts; otherwise use neutral titles.
5. **`/annonse/[id]`** (public detail):
   - Gallery with alt texts.
   - Badges: «Eksempel», «Privatperson», «Kan leveres».
   - Price per unit or «Lånes ut gratis»; deposit (or «Ingen depositum»); declared value is **not** shown publicly (it appears in the agreement only).
   - Handover options, accessories, usage restrictions, safety notice for restricted categories, locality «omtrentlig område».
   - Owner mini-profile (name, locality, member since).
   - Placeholder button «Send forespørsel» disabled with «Forespørsler åpner snart» until Phase 02.
   - «Rapporter annonse».
6. Search service in `src/modules/search/`:
   - one parameterised SQL query, with `websearch_to_tsquery('norwegian', q)` OR trigram similarity > 0.3;
   - all filters are indexed;
   - the query plan is checked with `EXPLAIN` in a test fixture.

## CONSTRAINTS
- No distances, travel times or maps (D-017).
- Paused, draft, removed and deleted listings are never shown to others.
- Demo listings are excluded from statistics and never shown without a badge.
- The page must be usable without JavaScript for the read-only parts (server-rendered).

## TESTS (acceptance criteria)
1. **Integration:**
   - "tilhengeren" finds a listing titled "Tilhenger med tipp" (Norwegian stemming);
   - "tilhnger" finds it via trigram.
2. **Integration:** the filters for category, locality, price range, delivery and type each narrow results correctly. Combined filters work.
3. **Integration:** a blocked period (`listing_unavailability`) excludes the listing from an overlapping availability search.
4. **Integration:** paused, draft and removed listings never appear. Demo listings disappear when `show_demo_listings` is off.
5. **Performance (local benchmark, recorded in the PR):** with 15 000 seeded listings, the search p95 is < 300 ms on the dev machine.
6. **e2e (mobile + desktop):** search «høytrykk», filter on Leinesfjord, open a listing; the «Eksempel» badge is visible on demo items.
7. **e2e:** the «Slik sorterer vi annonsene» link is reachable from the results page.
