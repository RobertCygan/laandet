---
doc_key: support_page
locale: nb
version: 0.1.0-utkast
status: UTKAST – sidetekst, ikke juridisk dokument
updated: 25.10.2026
---

<!--
UTVIKLERMERKNAD: Tekst for siden /stott-laandet. Se docs/SUPPORT_AND_FUNDING.md.
- Blokken merket «@block no_campaign» vises når SUPPORT_CAMPAIGN_URL ikke er satt (standard).
- Blokken merket «@block campaign_active» vises bare når eieren har opprettet en ekte innsamling og fylt ut alle feltene.
- Blokkmerkene er språknøytrale og er de samme i den engelske filen.
-->

# Støtt Laandet

Laandet utvikles som en lokal tjeneste for Steigen. Det er gratis å bruke plattformen. Hvis du ønsker
å bidra til serverkostnader, drift og videreutvikling, kan du støtte prosjektet frivillig. Alle bidrag
er valgfrie.

## Dette er alltid gratis

- Å opprette konto
- Å legge ut annonser
- Å gi bort ting
- Å sende forespørsler og meldinger

Laandet tar ingen provisjon. Det er ikke noe abonnement. Du får akkurat den samme tjenesten enten du
støtter oss eller ikke.

## Hva koster det å drive Laandet?

Pengene går til

- server og database,
- sikkerhetskopier,
- utsending av e-post,
- domenenavn,
- sikkerhet og videreutvikling.

Faktiske kostnader og bidrag ser du på siden [Åpenhet](/apenhet). Der viser vi bare tall vi har
kontrollert.

---

<!-- @block no_campaign -->

**Vi har ikke startet noen innsamling ennå.** Når en innsamling er klar, finner du lenken her.

---

<!-- @block campaign_active -->

Innsamlingen skjer hos **{{provider.name}}**. Laandet tar ikke selv imot penger.

- **Pengene går til:** {{recipient.legalName}}, org.nr. {{recipient.orgNumber}}
- **Gebyr:** {{provider.name}} trekker {{provider.feeText}}. Resten utbetales til mottakeren.
- **Skattefradrag:** Gaver til Laandet gir ikke rett til skattefradrag.
- **Formål:** Drift og videreutvikling av Laandet, som beskrevet over.

[Gå til innsamlingen hos {{provider.name}}]({{campaign.url}})

Støtte til Laandet har ingenting å gjøre med betaling for leie eller depositum. Det gjør dere opp
direkte med hverandre.
