# Laandet — Closed beta plan (P04-01)

**For the owner.** Status: planned. The beta needs the staging server and domain first
([`runbooks/SERVER_SETUP.md`](runbooks/SERVER_SETUP.md), [`runbooks/BILLING.md`](runbooks/BILLING.md)).

**Goal:** 10–20 people from Steigen use Laandet on staging for one week (week 50, 07.12–13.12.2026). Everything
they find goes into one list, and the go/no-go meeting on Friday 11.12.2026 knows what is still broken.

## 1. Who to invite

- 10–20 adults (18+) who live in Steigen and use a smartphone daily.
- A mix: people who have things to lend (tools, trailers, kayaks), people who need things, a few who are not used to apps, at least one person aged 60+, and both Norwegian and English speakers if possible.
- Two or three pairs who know each other, so they can try a full rental and a giveaway together.
- The people who will moderate during the pilot (named in [`PILOT_SUPPORT.md`](PILOT_SUPPORT.md)), so they practise on real reports.

Eier fyller inn: the list of names and how each was invited. Keep the list outside the repository.

## 2. How to give access

1. Staging is at `https://staging.<domain>`, behind a password (Caddy basic auth, user name `tester`; see
   [`../deploy/env/staging-basic-auth.caddy.example`](../deploy/env/staging-basic-auth.caddy.example)).
2. Share the address and the staging password **in person, by text message or through a password manager.
   Never in a public post.** Change the password after the beta.
3. Each tester then registers their own Laandet account on staging with their own email address. The
   verification email is real, so staging needs a working email setup (a sandbox or the real provider).
4. Give each tester the guide [`beta/TESTERVEILEDNING.md`](beta/TESTERVEILEDNING.md) (Norwegian), as a printout
   or a PDF.

**Staging is clearly a test:**
- every page shows the banner «Testversjon. Alt du legger inn her kan bli slettet. Ikke inngå ekte avtaler her.» (P04-01);
- search engines are told not to index it;
- demo listings are labelled «Eksempel».

**Rentals during the beta:** switch `rentals_open` on in `/admin/flagg` on staging (with a reason), so testers
can try the whole rental flow. That says nothing about production, where the flag stays off until the legal review
is done.

## 3. Day by day (week 50)

| Day | Date | What happens |
|---|---|---|
| Monday | 07.12 | Invite and onboard: access, registration, «Gi tilbakemelding». Ask everyone to publish one listing of each type they can. |
| Tuesday | 08.12 | Messages and giveaways: the pairs try a «Gis bort» from claim to «Gitt bort». Mobile usability sessions 1–2 ([`beta/BRUKERTEST.md`](beta/BRUKERTEST.md)). |
| Wednesday | 09.12 | Rentals: each pair runs a test rental from request to completed, with photos at handover and return, then reviews. Usability sessions 3–4. |
| Thursday | 10.12 | Problems on purpose: one pair opens a case («Meld fra om et problem») and tries proposals; testers report a listing or a message. The moderators handle the reports and practise the case flow. Usability session 5. |
| Friday | 11.12 | Triage of all open feedback. **Go/no-go meeting** ([`RELEASE_GATES.md`](RELEASE_GATES.md)). Thank the testers. |
| Weekend | 12.12–13.12 | Fixes for blockers only, then the production deploy for 14.12 ([`runbooks/LAUNCH.md`](runbooks/LAUNCH.md)). |

## 4. Collecting feedback

- **In the app:** «Gi tilbakemelding» (`/tilbakemelding`, linked in the footer and on the account page). The tester picks «Noe virker ikke», «Forslag til forbedring» or «Noe annet» and writes what happened. The page they came from is added automatically.
- **Staff list:** `/admin/tilbakemeldinger` for moderators and admins, newest first. Mark each item as handled when it has been triaged.
- **Usability sessions:** results go into the table in [`beta/BRUKERTEST.md`](beta/BRUKERTEST.md).
- Feedback that arrives by email or in person is entered in the app by the owner, so everything is in one place.

**Triage, once a day:** give each item a level, and decide fix now / fix after launch / won't fix.

| Level | Meaning | Before launch? |
|---|---|---|
| Blocker | Someone cannot finish a main task (register, publish, message, rent, give away, report), data goes to the wrong person, or something is unsafe | Must be fixed, or the pilot does not open (G4-6) |
| Serious | A main task works only with great difficulty, or text is wrong or misleading | Fixed before launch where possible; otherwise an owner decision |
| Minor | Annoying, but people get through | After launch |
| Cosmetic | Looks wrong, works | When there is time |

## 5. After the beta

- **Staging data is wiped before launch:** accounts, listings, messages, photos and feedback. Testers create new accounts on production. Tell them this on day one, and again at the end.
- Change the staging password.
- Record the outcome of the beta (number of testers, blockers found and fixed) in `CHANGELOG.md`.

## 6. Privacy

Testers are real people, and their staging data is personal data. It is handled like production data:
- kept only for the week;
- seen only by the owner, the developer and the moderators;
- deleted when staging is reset.

The tester guide says this in one paragraph.
