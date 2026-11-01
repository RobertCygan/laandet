# P01-02 — Design system ported from the prototype

## GOAL
Reproduce the established Nordic visual identity of the prototype as a small set of reusable,
accessible components. Do not redesign.

## CONTEXT
- Prototype: `Laanndet.html` (bundle only, no source).
- Extracted assets are in `laandet/design/prototype/`:
  - `prototype.css` (tokens and component styles)
  - `favicon.svg`
  - `images/`
  - `demo-content.json`
- Screen inventory and design tokens: `docs/CURRENT_STATE_ASSESSMENT.md` §2–3.
- Fixes required: P1 (name "Laandet"), P6 (minimum font sizes), P9 (no intro film).

## INPUT
- Tokens: `--background #fcfbf8`, `--surface #f2f3ed`, `--primary #174d3c`, `--primary-hover #103c2e`, `--secondary #e7eee6`, `--accent #d9ba83`, `--text #253b32`, `--text-muted #596650`, `--border #e2e5dc`, `--danger #a33d36`, radius 12 px (cards) / 7 px (buttons), focus ring `3px solid #bd8c38`.
- Font: Manrope variable from `@fontsource-variable/manrope` (SIL OFL), self-hosted.
- Copy guidance: master spec §2 terms (`Logg inn`, `Legg ut annonse`, `Leies ut`, `Ønskes leid`, `Gis bort` …).

## OUTPUT
1. `src/app/globals.css`: Tailwind 4 `@theme` with the tokens above as CSS variables; base styles from `prototype.css` (body, headings, `.container` width rule, focus ring).
2. `src/ui/` components:

   | Group | Components |
   |---|---|
   | Layout and navigation | `SiteHeader` (desktop nav plus mobile menu with focus trap), `SiteFooter`, `Breadcrumb`, `SkipLink` |
   | Actions and labels | `Button` (variants `primary`, `outline`, `subtle`, `ghost`, `cream`; sizes `md` 47 px and `sm` 44 px min), `Pill`, `Badge` (`Eksempel`, `Privatperson`, `Kan leveres`, status badges) |
   | Content blocks | `ListingCard` (image, badges, category, title, locality «omtrentlig område», price per unit), `CategoryTile`, `Notice` (info / warning / danger), `EmptyState` |
   | Form fields | `TextField`, `TextArea` (with counter), `Select`, `Checkbox`, `RadioCards`, `MoneyInput` (kr in UI, øre in value), `DateRangeField`, `PhotoPicker` shell |
   | Wizard | `Stepper` (wizard progress) |
   | Brand | `Logo` (favicon mark plus wordmark «Laandet.» with the dot in `#8da17b`) |

3. `src/app/[locale]/dev/ui/page.tsx`: a component gallery, available only when `APP_ENV=development`.
4. `public/` contains `favicon.svg`. The hero image is copied from `design/prototype/images/hero.webp` with the caption «Illustrasjonsbilde · KI-generert».
5. `docs/DESIGN_SYSTEM.md`: a short table mapping tokens to components to prototype class names.

## CONSTRAINTS
- Visual identity is preserved: colour, typography, radii, spacing rhythm, card style.
- Changes need owner approval, except accessibility fixes:
  - minimum 12 px text;
  - 16 px inputs (prevents iOS zoom);
  - touch targets ≥ 44×44 px;
  - WCAG 2.1 AA contrast.
- No intro video and no animation longer than 200 ms. `prefers-reduced-motion` is respected.
- AI-generated images always carry a caption saying so.

## TESTS (acceptance criteria)
1. Playwright opens `/dev/ui` at 390 px and 1280 px. Screenshots are attached to the PR for owner review (human check, not pixel-diff).
2. `@axe-core/playwright` scan of `/dev/ui` and of the home placeholder finds **0 serious or critical** violations.
3. Keyboard test:
   - Tab reaches the skip link first, then the header links.
   - The mobile menu opens with Enter, traps focus and closes with Escape.
   - The focus ring is visible.
4. The owner confirms in the PR that the look matches the prototype.
