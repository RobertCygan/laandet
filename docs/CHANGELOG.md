# Changelog

All notable changes to Laandet. Dates are DD.MM.YYYY.

## [Phase 00] — 25.10.2026

### Added
- **Inventory** of the existing repository and prototype (`CURRENT_STATE_ASSESSMENT.md`):
  - every prototype route was rendered and its text captured;
  - design tokens, 19 images, the favicon and demo content were extracted to `design/prototype/`.
- **Master specification** stored verbatim, with an amendments table (`MASTER_SPECIFICATION.md`).
- **Decision log** D-001…D-029 (`DECISIONS.md`), all *Proposed*. Highlights:
  - two UI languages (nb + en);
  - Next.js + Drizzle + Better Auth + PostgreSQL on one EU VPS;
  - no money flows;
  - category B (> 5 000 kr) blocked;
  - paid rental of means of transport paused pending the DPI question.
- **Architecture** (`ARCHITECTURE.md`), **data model** with state machines and privileges (`DATA_MODEL.md`),
  **authentication/authorisation model** (`AUTH_MODEL.md`).
- **Reference database schema** `db/schema-draft.sql`, with **executable checks** `db/schema-checks.sql`.
  Applied to PostgreSQL 16 on 25.10.2026: **23/23 checks passed**.
- **Security requirements** (`SECURITY.md`, SEC-01…63) and **threat model** (`THREAT_MODEL.md`, 29 threats).
- **System designs:** condition reports, rental agreements, dispute workflow, prohibited/restricted items,
  privacy and retention, voluntary support and transparency page.
- **Legal drafts in Norwegian Bokmål** (`legal/nb/`), all marked *UTKAST – ikke juridisk gjennomgått*:
  - brukervilkår
  - personvernerklæring
  - informasjonskapsler
  - forenklet leieavtale
  - utvidet leieavtale
  - gis bort – overleveringsbekreftelse
  - retningslinjer for tvister
  - forbudte og begrensede gjenstander
  - retningslinjer for trygg utleie
  - Støtt Laandet page text
- **English informational translations** of all legal drafts (`legal/en/`).
- **Legal review checklist** based on research on 25.10.2026, separating verified facts, assumptions and questions (`LEGAL_REVIEW_CHECKLIST.md`).
- **Cost model** for 100/500/2 000/10 000 users, including the 2026 Hetzner price changes (`OPERATING_COSTS.md`).
- **Test strategy** (`TEST_STRATEGY.md`) and **roadmap** to 14.12.2026 with release gates and the owner decisions needed (`DEVELOPMENT_ROADMAP.md`).
- **Phase 01 task definitions** P01-01…P01-13 (`tasks/`).

### Not changed
- `Laanndet.html`, `www/` and all other existing files are untouched.
