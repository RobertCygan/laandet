---
doc_key: rental_extended
locale: nb
version: 0.1.0-utkast
status: UTKAST – ikke juridisk gjennomgått · IKKE I BRUK I PILOTFASEN
updated: 25.10.2026
applies_to: oppgitt verdi > 5 000 kr (> 500 000 øre)
template_syntax: Mustache (logikkløs), som forenklet-leieavtale.md
---

<!--
UTVIKLERMERKNAD:
- Malen kan ikke tas i bruk før disse forutsetningene er på plass (DECISIONS D-011):
  (1) sterk identitetskontroll (BankID eller tilsvarende) for begge parter,
  (2) en juridisk vurdert ordning for depositum, helst gjennom en godkjent betalingstjeneste,
  (3) flagget `extended_agreements` er slått på, og databasebegrensningen `mvp_category_a_only` er fjernet med en migrering.
- Godkjenningene står ikke i teksten (se forenklet-leieavtale.md).
-->

> **UTKAST – IKKE JURIDISK GJENNOMGÅTT – IKKE I BRUK.** Utleie av gjenstander med oppgitt verdi over
> 5 000 kr er ikke åpnet i Laandet ennå. Malen er et førsteutkast laget med hjelp av KI, og den må
> godkjennes av en kvalifisert norsk jurist før den kan brukes.

# Utvidet leieavtale

**Avtalenummer:** {{agreementNumber}} · **Versjon av avtalen:** {{revision}} · **Mal:** Utvidet leieavtale {{templateVersion}}

Avtalen gjelder leie av en gjenstand med oppgitt verdi på **over 5 000 kr**. Avtalen inngås mellom
utleier og leietaker. **Laandet er ikke part i avtalen.**

## Kort fortalt

- Du leier **{{item.title}}** fra **{{period.start}}** til **{{period.end}}**.
- Leien er **{{price.total}}**. Depositumet er **{{deposit.amount}}** og er obligatorisk.
- Begge parter har kontrollert identiteten sin med {{identity.providerLabel}}.
- Bilder ved utlevering og ved tilbakelevering er obligatoriske.
- «Leiegjenstanden skal leveres tilbake i minst like god stand som ved overtakelsen, med unntak av
  normal slitasje som følge av avtalt og forsvarlig bruk.»
- **Depositumet er ikke en forsikring og dekker ikke nødvendigvis hele et eventuelt tap.**

## Del A – Grunnvilkår

Punktene 1–17 i Laandets **forenklede leieavtale** ({{baseTemplateVersion}}) gjelder også for denne
avtalen. De står i sin helhet nedenfor. Der Del B sier noe annet, gjelder Del B.

{{> forenklet-leieavtale-kjerne}}

<!-- Renderen setter inn punkt 1–17 fra forenklet-leieavtale.md her, uten innledningen og «Kort fortalt». -->

## Del B – Tilleggsvilkår for gjenstander med verdi over 5 000 kr

### B1. Obligatorisk depositum

B1.1 Partene har avtalt et depositum på **{{deposit.amount}}**. {{deposit.paymentNote}}

B1.2 Depositumet skal stilles før gjenstanden leveres ut. Hvis depositumet ikke er stilt, har utleieren
ikke plikt til å levere ut gjenstanden.

B1.3 Depositumet er ikke det samme som gjenstandens verdi. Det er ikke en forsikring, og det dekker ikke
nødvendigvis hele et eventuelt tap.

B1.4 Reglene for tilbakebetaling og tilbakeholdelse står i punkt B13.

### B2. Identitetskontroll

Begge parter har kontrollert identiteten sin med **{{identity.providerLabel}}**:

- utleieren den {{identity.ownerVerifiedAt}},
- leietakeren den {{identity.renterVerifiedAt}}.

Laandet lagrer ikke fødselsnummer.

### B3. Detaljert tilstandsliste

Før utleveringen skal utleieren fylle ut en detaljert tilstandsliste i Laandet. Listen skal beskrive:

- generell tilstand,
- alle synlige skader, riper og bulker, og hvor de er,
- slitasjedeler og hvor slitt de er (for eksempel dekk, blad, kjede og batteri),
- renhold,
- drivstoff- eller batterinivå, hvis det er relevant.

Leietakeren skal gå gjennom listen sammen med utleieren, og kan føye til egne merknader eller bestride
punkter før utleveringen.

### B4. Obligatoriske bilder ved utlevering

Før utleveringen skal det lastes opp **minst {{photos.minimum}} bilder** som viser gjenstanden fra
flere sider. Kjente skader og eventuelt serienummer skal også være med på bildene. Gjenstanden leveres
ikke ut før bildene er lastet opp.

### B5. Obligatoriske bilder ved tilbakelevering

Ved tilbakeleveringen skal det lastes opp **minst {{photos.minimum}} bilder** på samme måte.

Er det ikke mulig å ta bilder, for eksempel fordi telefonen mangler eller det er helt mørkt, skal den
som registrerer tilbakeleveringen, skrive hvorfor i Laandet. Bildene skal da tas så snart det lar seg
gjøre, og senest 24 timer etter tilbakeleveringen.

### B6. Serienummer og kjennetegn

{{#item.identifier}}Gjenstanden har serienummer eller kjennetegn **{{item.identifier}}**. Partene
kontrollerer det ved utleveringen og ved tilbakeleveringen.{{/item.identifier}}
{{^item.identifier}}Gjenstanden har ikke noe serienummer. Partene beskriver kjennetegn som gjør det mulig
å kjenne den igjen, i tilstandslisten.{{/item.identifier}}

### B7. Funksjonstest og kontroll av tilbehør

Ved utleveringen tester partene sammen at gjenstanden fungerer som den skal. Testen beskrives i
tilstandslisten. Partene kontrollerer også at alt tilbehøret er med. Det samme gjøres ved
tilbakeleveringen.

### B8. Særlige bruksbegrensninger

{{#permittedUse}}{{permittedUse}}{{/permittedUse}}
{{^permittedUse}}Ingen særlige begrensninger utover punkt 9 i Del A.{{/permittedUse}}

Gjenstanden kan ikke tas med ut av Norge uten at utleieren har sagt ja skriftlig.

### B9. Krav til bruk og sikkerhet

{{#safetyNotice}}{{safetyNotice}}{{/safetyNotice}}

Leietakeren bekrefter at han eller hun har den erfaringen, det verneutstyret og eventuelt den
førerretten eller det sertifikatet som trengs for å bruke gjenstanden trygt og lovlig. Utleieren skal
gi en innføring i bruken ved utleveringen.

### B10. Forsikring

{{#insurance.note}}{{insurance.note}}{{/insurance.note}}
{{^insurance.note}}Partene har ikke opplyst om forsikring som dekker gjenstanden under leieperioden.{{/insurance.note}}

Laandet har ingen forsikring som dekker brukerne. Partene bør selv sjekke hva deres egne forsikringer
dekker.

### B11. Varsling av skade og dokumentasjon

B11.1 Oppstår det skade, en feil eller et tap i leieperioden, skal leietakeren straks:

1. slutte å bruke gjenstanden hvis det er utrygt å bruke den,
2. si fra til utleieren,
3. melde fra i Laandet med «Meld fra om et problem» innen **24 timer** og laste opp bilder,
4. ved tyveri anmelde forholdet til politiet og laste opp bekreftelsen på anmeldelsen.

B11.2 Utleieren som vil kreve erstatning, skal dokumentere kravet med bilder og beskrivelse. Hvis det er
mulig, skal utleieren også legge ved et pristilbud eller en kvittering på reparasjonen.

### B12. Bekreftelse av tilbakelevering

Tilbakeleveringen er bekreftet når begge parter har bekreftet tilstanden ved tilbakelevering i Laandet,
med bilder etter punkt B5. Hvis én part ikke bekrefter, står det tydelig i rapporten. Det regnes da ikke
som en felles bekreftelse.

### B13. Tilbakebetaling av depositum og uenighet

B13.1 Utleieren skal betale tilbake depositumet når tilbakeleveringen er bekreftet uten avvik.

B13.2 Hvis utleieren mener at han eller hun har et krav, må kravet meldes i Laandet innen
**{{deadlines.depositClaimHours}} timer** etter tilbakeleveringen. Kravet skal være konkret og ha et beløp.
Utleieren kan holde tilbake inntil det beløpet kravet gjelder. Resten skal betales tilbake uten unødig
opphold.

B13.3 Det beløpet som holdes tilbake, gjøres opp når partene er enige. Det kan også gjøres opp når
forliksrådet eller domstolene har avgjort saken. **Laandet bestemmer ikke hvem som skal ha
depositumet.**

{{#deposit.providerManaged}}B13.4 Depositumet håndteres av {{deposit.providerName}}. Utbetaling skjer etter
de vilkårene som er beskrevet i Laandet.{{/deposit.providerManaged}}

### B14. Gjenstand som ikke blir levert tilbake, og mistanke om tyveri

B14.1 Hvis gjenstanden ikke er levert tilbake innen 24 timer etter at leieperioden var slutt, og
leietakeren ikke har tatt kontakt, kan utleieren registrere den som **«Ikke tilbakelevert»** i Laandet.
Laandet varsler da leietakeren.

B14.2 Hvis leietakeren fortsatt ikke leverer tilbake gjenstanden eller tar kontakt, kan utleieren anmelde
forholdet til politiet. Laandet kan begrense leietakerens konto mens saken pågår. Laandet kan også
utlevere opplysninger til politiet når politiet ber om det og loven gir adgang til det.

B14.3 En registrering av at gjenstanden ikke er levert tilbake, eller en anmeldelse, er **ikke** et bevis
for at noen har begått en straffbar handling. Laandet viser aldri slike saker offentlig.

## Godkjenning

Avtalen gjelder når begge parter har godtatt den i Laandet. Hvis dere endrer noe vesentlig, må dere
begge godta avtalen på nytt. Laandet lagrer tidspunktet for hver godkjenning og en kontrollsum (SHA-256)
av avtaleteksten.

*Godkjenningene står under avtalen i Laandet.*
