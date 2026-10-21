# Validation — 21 October 2026

Validated in the prepared Linux cloud workspace, with Node.js 24.19.0, npm 11.9.0, Next.js 16.4.2 and Google Chrome 156.0.8078.47. This report describes local validation, not a public deployment or a restored future environment.

## Executed checks

| Command                                | Actual result                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm install`                          | Passed; application and development dependencies installed and lockfile generated                                     |
| `npm ci --cache /workspace/.cache/npm` | Passed; clean, frozen-lockfile reinstall (498 packages)                                                               |
| `npm run browser:install`              | Passed; official Chrome repository signature and SHA256 chain verified, browser extracted without system installation |
| `npm run lint`                         | Passed with zero warnings                                                                                             |
| `npm run typecheck`                    | Passed                                                                                                                |
| `npm run build`                        | Passed; 41 generated pages including framework entries, plus dynamic discovery and wizard routes                      |
| `npm test`                             | **35 passed, 0 failed, 0 skipped**, 40.1 seconds, three workers, against production server                            |
| `npm run audit:lighthouse`             | Passed; local production homepage audited separately from browser tests                                               |
| `npm audit --omit=dev`                 | Zero reported production dependency vulnerabilities at validation time                                                |

The final Playwright run covers homepage disclosure, all 18 demo offers, all 19 category cards, search, category/area/price/unit/date/delivery filters, persistent favorites, both listing types, detail/gallery/calendar/delivery prices, wanted responses, all nine survey questions and validation, optional contact/consent, both wizard paths, local image upload/preview and draft restoration, launch-interest disclosure, privacy opt-out/export/delete, fictional profiles, actual 404 response, mobile navigation, approximate map interactions and the absence of transaction HTTP mutations.

Automated WCAG-tagged axe checks passed on the homepage, discovery, detail, wizard, privacy page and open survey dialog. Keyboard dialog focus containment and Escape behavior were exercised. No browser console errors occurred in the normal tested flows. The intentional 404 test permits the browser's expected missing-resource diagnostic.

Responsive assertions passed at **360, 390, 430, 768, 1024, 1440 and 1920 px**. Each size checks home, discovery, detail and wizard for horizontal overflow, and captures a full-page home screenshot. This is Chromium-based validation, not a claim of Safari, Firefox, assistive-technology or real-device coverage.

## Lighthouse — final measured run

| Category / metric        | Mobile  | Desktop |
| ------------------------ | ------- | ------- |
| Performance              | **94**  | **100** |
| Accessibility            | **100** | **100** |
| Best Practices           | **100** | **100** |
| SEO                      | **100** | **100** |
| Largest Contentful Paint | 3.0 s   | 0.6 s   |
| Total Blocking Time      | 70 ms   | 0 ms    |
| Cumulative Layout Shift  | 0       | 0       |

The mobile run uses Lighthouse's default mobile emulation and simulated throttling. Desktop uses 1440 × 1000 emulation, 40 ms RTT, 10 Mbps throughput and 1× CPU throttling. Results are local measurements, can vary between runs and do not predict a deployed host's latency. Automated accessibility scores are not a full WCAG conformance audit.

Raw HTML/JSON reports are in ignored `reports/lighthouse-mobile.*` and `reports/lighthouse-desktop.*`. Playwright HTML output is in ignored `playwright-report/`; screenshots are in ignored `test-results/home-*.png`. Re-run the documented commands to regenerate them.

Optimization included one preloaded local variable Manrope font, deferred survey-dialog JavaScript, responsive image sizes, local WebP images and Next Image lazy loading. Earlier lower performance measurements were used for diagnosis and are superseded by the final run above.

## Diagnosed setup issue

The network policy blocks Playwright's browser CDN. The npm-packaged serverless Chromium fallback also intermittently failed while opening a new context, before loading the app. Full official Chrome resolved those harness failures without weakening network or artifact verification. The browser installer pins Google's primary signing-key fingerprint and verifies the signed repository Release, package-index SHA256 and package SHA256. It uses `dl.google.com`, already covered by the package-manager network preset. The final 35-test result uses full Chrome, not the unstable fallback. No tests or assertions were disabled to obtain the final pass.

## Scope and remaining limits

- All offers, wanted posts, owner profiles and prices are explicit fictional examples. Product images are generated, single-view images. The map is illustrative; the calendar is an example.
- Research responses, optional contacts and drafts are stored **only in the current browser**. No team inbox or central waitlist receives them. The dashboard contains actual local activity, no synthetic visitor metrics. A public unmoderated study needs a secure backend and protected reporting.
- `/research` is omitted from normal navigation and indexed content; it is not authenticated administration and contains only that browser's local data.
- Authentication, messaging, BankID, real bookings, payments, deposits, reviews, insurance and real delivery agreements are intentionally unimplemented.
- Legal/privacy text is an original research-stage placeholder. Responsible business identity, public contact information, lawful processing basis and final rental rules must be established before real operations.
- No production domain is invented. Set the real deployment origin for canonical/social-image metadata and a future sitemap.
- Next dev generated the repository AGENTS.md guidance and refreshed Next type declarations; these are expected framework setup files. The existing empty checkout was retained without resets or worktrees.
- The project has not been pushed to GitHub, deployed to Vercel, or independently restored into a fresh task. Cloud install/start instructions are saved as a reviewable draft; publication is a separate user action.

## Follow-up: one HTML file with the supplied logo intro

The follow-up version embeds the complete demo in `out/Laanndet.html` (8.35 MiB), including both unmodified user-supplied seven-second G-PSI videos, all equipment imagery, hero, font, CSS and JavaScript. No installation, server or internet connection is required to open this file. A Content Security Policy blocks outgoing connections. All internal navigation uses hash routes. Research answers and drafts remain local to the browser.

The full updated `npm test` run completed with **50 passed, 0 failed, 0 skipped** in 1.4 minutes, using full Chrome. This includes the original 35 marketplace checks, 10 single-file checks with the network disabled, and 5 intro checks: natural completion on the web, actual offline video decoding/playback, keyboard skipping/focus containment, reduced-motion bypass without video loading, and safe fallthrough after a playback error. Automated accessibility checks passed on the intro as well as the single-file homepage and survey. Lint, TypeScript and the production Next build passed after these changes.

The intro plays once per document opening, not on internal navigation. It uses a contained square video to preserve the entire supplied logo, muted inline autoplay, a visible skip button, Escape handling and a short fade into the app. Reduced-motion preference bypasses it. WebM is preferred, with MP4 fallback; both are embedded in the single file.

The Lighthouse numbers above were measured before the newly requested seven-second intro and must not be described as scores for this new startup sequence. Lighthouse was not repeated for this follow-up. In this cloud instance, the development HMR WebSocket returned an invalid handshake during diagnosis; the web follow-up was therefore built and validated against the production server, and the portable file was validated independently with network access disabled.

The downloadable HTML at `/workspace/artifacts/Laanndet-z-intro.html` is byte-identical to the tested build. `/workspace/artifacts/Laanndet-z-intro.zip` contains just that HTML file for convenient transfer.

## Download troubleshooting follow-up

The original ZIP passed its integrity check and contained the exact tested HTML. The artifact directory had mode 0700; it was changed to 0755, while public demo downloads use 0644. A smaller download variant was also generated at `/workspace/artifacts/Laanndet.html` (4,541,374 bytes) and `/workspace/artifacts/Laanndet.zip` (3,225,360 bytes). It preserves the original 1080p WebM and uses a 720p H.264 MP4 fallback, retaining the same seven-second animation, application code and embedded assets. Original user uploads and the original exported files were preserved. ZIP integrity and HTML equality inside that ZIP were verified. The compact MP4 was explicitly selected and decoded with browser network disabled; playback ended, the homepage appeared, and no page errors or external requests were observed. Frontend artifact-download completion cannot be verified through the execution tools; the alternate sandbox-prefixed links are provided for the user to try.

## Browser-local save fallback

Added preview-only save/copy controls to the standalone HTML, with `Zapisz HTML` at the lower left after the intro. The save action serializes the embedded document into a Blob, removes preview controls/scripts, clears rendered React state and resets transient body scroll locking. It does not call a cloud download API or include localStorage research data.

Direct browser checks passed: (1) the in-page button downloaded a complete HTML and that saved copy reopened offline with all 18 rentals; (2) download worked inside an iframe sandbox permitting downloads; (3) manual selected-text copying worked inside a sandbox without download permission with the Clipboard API deliberately unavailable. No page exceptions were observed. These tests do not establish the actual chat preview's sandbox permissions. The new preview is `/workspace/artifacts/Laanndet-zapis.html`.
