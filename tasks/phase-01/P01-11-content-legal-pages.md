# P01-11 — Content pages and legal document publishing

## GOAL
Publish the informational pages and the legal documents in Norwegian and English. Each legal text is versioned, its
hash is stored, and it is clearly marked as a draft until legal review is complete.

## CONTEXT
- Master spec §16, §17, §20 (pages 13–16).
- Decisions D-001, D-023, D-026.
- Texts in `legal/nb/` (authoritative) and `legal/en/` (informational).
- Prototype copy for «Om», «Trygghet», «Slik fungerer det» and FAQ (`CURRENT_STATE_ASSESSMENT.md` §2) must be updated where facts changed: P2 (Vipps), P1 (name).

## INPUT
- Markdown files with front matter (`doc_key`, `locale`, `version`, `status`).
- `SUPPORT_CAMPAIGN_URL` (empty by default).

## OUTPUT
1. **Pages (nb + en):**

   | Page | Path | Notes |
   |---|---|---|
   | Hjem | `/` | sections wired in P01-10 |
   | Slik fungerer det | `/slik-fungerer-det` | rent, request, give away, step by step |
   | Trygghet | `/trygghet` | only facts that are true now; planned features labelled «Planlagt» |
   | Støtt Laandet | `/stott-laandet` | blocks as defined in `legal/nb/stott-laandet.md`; **no external link unless `SUPPORT_CAMPAIGN_URL` is set** |
   | Åpenhet | `/apenhet` | empty state until real figures exist |
   | Om Laandet | `/om` | |
   | Kontakt | `/kontakt` | operator details from config; shows `MÅ FYLLES UT` in staging only, and the production build fails if they are missing |

2. **Legal pages:** `/vilkar`, `/personvern`, `/informasjonskapsler`, `/retningslinjer/tvister`, `/retningslinjer/forbudte-gjenstander`, `/retningslinjer/trygg-utleie`, plus the agreement templates under `/avtaler/*` (read-only sample view).
3. **Legal page rendering:**
   - A sanitising Markdown renderer (`src/ui/LegalMarkdown.tsx`, the only allowed `dangerouslySetInnerHTML`). It uses an allow-list of tags and no raw HTML. HTML comments are stripped.
   - Each page shows the version, the effective date and, while `is_draft = true`, a banner «Utkast – ikke juridisk gjennomgått».
   - English pages show «The Norwegian version prevails» with a link to the Norwegian text.
4. **Legal loader** `scripts/load-legal.ts`:
   - runs at deploy with the owner role;
   - reads `legal/**`, computes SHA-256 and inserts new versions into `legal_document_versions`;
   - is idempotent: an unchanged hash inserts nothing;
   - refuses to load into production if the text contains `MÅ FYLLES UT` or `KONTROLLERES FØR LANSERING`, unless `--allow-draft` is given (staging only).
5. Footer links to all of the above in both languages.
6. **Re-acceptance:** if a new `terms` or `privacy` version has `material_change = true`, signed-in users are asked to accept it at their next visit.

## CONSTRAINTS
- Planned features are never described as live.
- No donation prompts outside the support page and the footer link.
- No external scripts or embeds.

## TESTS (acceptance criteria)
1. **e2e:** every footer link resolves (200) in nb and en. The legal pages show version and draft banner.
2. **e2e (N11):** with `SUPPORT_CAMPAIGN_URL` empty, `/stott-laandet` contains no outbound link and shows «Vi har ikke startet noen innsamling ennå».
3. **e2e (N11):** a complete register → publish journey never visits or requires the support page.
4. **Unit:** `LegalMarkdown` strips `<script>`, `onerror=` and `javascript:` links from a malicious fixture. HTML comments are not rendered.
5. **Integration:**
   - the loader inserts a new version only when the hash changes;
   - the production mode refuses files with `MÅ FYLLES UT`.
6. **Integration:** after a material terms change, a signed-in user is redirected to accept it before publishing.
