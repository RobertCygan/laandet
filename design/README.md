# Laandet — Design assets

`prototype/` contains assets **extracted unchanged** from the community-tested prototype `../../Laanndet.html`
(25.10.2026). The prototype itself is not modified.

| File | Content | Use |
|---|---|---|
| `prototype/prototype.css` | Full prototype stylesheet. The embedded Manrope font was removed (install `@fontsource-variable/manrope`, SIL OFL 1.1). | Source of design tokens and component styles for P01-02 |
| `prototype/favicon.svg` | App mark: two arrows on deep green `#174d3c` | Favicon and logo mark |
| `prototype/images/hero.webp` | AI-generated Nordland fjord scene | Home hero, always captioned «Illustrasjonsbilde · KI-generert» |
| `prototype/images/equipment-1…18.webp` | AI-generated product photos | **Only** for listings labelled «Eksempel» |
| `prototype/demo-content.json` | 18 rental and 5 wanted example listings, 19 categories, 8 localities (prices in øre) | Seed for demo listings (P01-04). Declared values must be added, and the prohibited `minigraver` must be excluded. |

Image ↔ listing mapping (from the prototype bundle):

| Images | Demo listings |
|---|---|
| 1–6 | høytrykksspyler, tepperenser, motorsag, vedkløyver, borhammer, takboks |
| 7–12 | biltilhenger, varetilhenger, rullestillas, kajakk, SUP, slalåm |
| 13–18 | snøfreser, hekksaks, gressklipper, partytelt, projektor, gassgrill |

See `../docs/CURRENT_STATE_ASSESSMENT.md` §3 for the design tokens and §2 for screen-by-screen notes.
