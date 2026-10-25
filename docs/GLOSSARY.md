# Laandet — Glossary (nb ↔ en)

Fixed product terms for the interface, emails and legal translations. Code identifiers are in English
(right column). Extend this file in P01-03. Do not translate a term differently in one place only.

| Norsk (nb, authoritative) | English (en UI) | Code identifier |
|---|---|---|
| Leies ut | For rent | `listing.type = 'rent_out'` |
| Lånes ut gratis | Lent for free | `rent_out` with `price_ore = 0` |
| Ønskes leid | Wanted | `listing.type = 'wanted'` |
| Gis bort | Giving away / give away | `listing.type = 'give_away'` |
| Gitt bort | Given away | `listing.status = 'given_away'` |
| Annonse | Listing | `listing` |
| Legg ut annonse | Post a listing | — |
| Utleier | Owner | `owner` |
| Leietaker | Renter | `renter` |
| Giver / Mottaker | Giver / Recipient | `giver` / `recipient` (claimant) |
| Forespørsel | Request | `booking.status = 'requested'` |
| Send forespørsel | Send request | — |
| Lei nå | Rent now | — |
| Leieforhold / Mine leieforhold | Rental / My rentals | `booking` |
| Forenklet leieavtale | Simplified rental agreement | `contract.kind = 'rental_simple'` |
| Utvidet leieavtale | Extended rental agreement | `rental_extended` |
| Overleveringsbekreftelse | Transfer confirmation | `giveaway_transfer` |
| Jeg godtar avtalen | I accept the agreement | `contract_acceptance` |
| Oppgitt verdi | Declared value | `declared_value_ore` |
| Depositum | Deposit | `deposit_ore` |
| Hentes av leietaker | Collected by the renter | `handover_method = 'pickup'` |
| Kan leveres av eier | Can be delivered by the owner | `owner_delivery` |
| Møtes på avtalt sted | Meet at an agreed place | `meet` |
| Tilstand ved utlevering | Condition at handover | `condition_report.phase = 'handover'` |
| Tilstand ved tilbakelevering | Condition at return | `phase = 'return'` |
| Tilbakelevert uten merknader | Returned without remarks | `returned_ok` |
| Tilbakelevert med normal slitasje | Returned with normal wear and tear | `returned_normal_wear` |
| Tilbakelevert med registrert avvik | Returned with a recorded deviation | `returned_with_deviation` |
| Tilbakelevering bestridt | Return disputed | `return_disputed` |
| Ikke tilbakelevert | Not returned | `not_returned` |
| Bekreftet av én part | Confirmed by one party | `condition_report.status = 'lapsed'` |
| Normal slitasje | Normal wear and tear | — |
| Meld fra om et problem | Report a problem | `dispute` |
| Be Laandet om hjelp | Ask Laandet for help | `dispute.status = 'support_review'` |
| Sak / sak under behandling | Case / case in progress | `dispute` |
| Rapporter / Rapporter annonse | Report / Report listing | `report` |
| Klag på avgjørelsen | Appeal the decision | `appeal` |
| Privatperson | Private person | — |
| Eksempel | Example | `is_demo` |
| Støtt Laandet | Support Laandet | — |
| Åpenhet | Transparency | — |
| Min profil | My profile | — |
| Logg inn / Opprett konto / Logg ut | Sign in / Create account / Sign out | — |
| Forliksrådet | the conciliation board (forliksrådet) | — |
