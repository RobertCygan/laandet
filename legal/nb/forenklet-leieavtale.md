---
doc_key: rental_simple
locale: nb
version: 0.1.0-utkast
status: UTKAST – ikke juridisk gjennomgått
updated: 25.10.2026
applies_to: oppgitt verdi ≤ 5 000 kr (≤ 500 000 øre)
template_syntax: Mustache (logikkløs). {{felt}} = verdi, {{#felt}}…{{/felt}} = vises hvis satt, {{^felt}}…{{/felt}} = vises hvis ikke satt. Alle verdier settes inn som ren tekst.
---

<!--
UTVIKLERMERKNAD (vises ikke for brukerne):
- Malen fylles ut på serveren fra et ContractTerms-objekt (docs/RENTAL_AGREEMENTS.md §2).
- Beløp formateres som «1 500 kr» og datoer som «14.12.2026 kl. 10:00» (Europe/Oslo).
- Godkjenningene står IKKE i teksten. De vises under avtalen, slik at kontrollsummen (SHA-256)
  for teksten ikke endres når en part godtar.
-->

> **UTKAST – IKKE JURIDISK GJENNOMGÅTT.** Malen er et førsteutkast laget med hjelp av KI. Den skal ikke
> brukes til ekte avtaler før en kvalifisert norsk jurist har godkjent den.

# Forenklet leieavtale

**Avtalenummer:** {{agreementNumber}} · **Versjon av avtalen:** {{revision}} · **Mal:** Forenklet leieavtale {{templateVersion}}

Avtalen gjelder leie eller utlån av en gjenstand med oppgitt verdi på **5 000 kr eller mindre**. Avtalen
inngås mellom utleier og leietaker. **Laandet er ikke part i avtalen.** Laandet stiller bare til rådighet
tjenesten der avtalen inngås og dokumenteres.

## Kort fortalt

- Du leier **{{item.title}}** fra **{{period.start}}** til **{{period.end}}**.
- {{#price.isFree}}Gjenstanden lånes ut **gratis**.{{/price.isFree}}{{^price.isFree}}Leien er **{{price.total}}**. Den betales direkte mellom dere.{{/price.isFree}}
- Depositum: **{{deposit.summary}}**
- Utlevering: **{{handover.summary}}** · Tilbakelevering: **{{return.summary}}**
- «Leiegjenstanden skal leveres tilbake i minst like god stand som ved overtakelsen, med unntak av
  normal slitasje som følge av avtalt og forsvarlig bruk.»
- Hvis noe skjer, trykker du på **«Meld fra om et problem»** i Laandet.
- Laandet tar ikke imot penger og sender aldri betalingslenker.

## 1. Partene

| | Visningsnavn | Laandet-ID |
|---|---|---|
| **Utleier** | {{owner.displayName}} | {{owner.platformId}} |
| **Leietaker** | {{renter.displayName}} | {{renter.platformId}} |

Begge parter har selv bekreftet at de er minst 18 år, og at de inngår avtalen som privatpersoner.
Partene har bekreftet e-postadressen sin i Laandet. **Identiteten deres er ikke kontrollert med BankID
eller andre identitetsbevis.**

## 2. Leiegjenstanden

- **Gjenstand:** {{item.title}}
- **Kategori:** {{item.categoryLabel}}
- **Beskrivelse:** {{item.description}}
{{#item.identifier}}- **Serienummer eller kjennetegn:** {{item.identifier}}
{{/item.identifier}}- **Tilstand ifølge annonsen:** {{item.condition}}
- **Kjente feil og mangler:** {{#item.knownDefects}}{{item.knownDefects}}{{/item.knownDefects}}{{^item.knownDefects}}Ingen oppgitt{{/item.knownDefects}}

**Tilbehør som følger med:**
{{#accessories}}
- {{.}}
{{/accessories}}
{{^accessories}}
- Ikke noe tilbehør er oppgitt.
{{/accessories}}

## 3. Oppgitt verdi

Utleier anslår at det koster omtrent **{{declaredValue}}** å skaffe en tilsvarende gjenstand.
Verdien er utleiers eget anslag. Laandet har ikke kontrollert den. Verdien er heller ikke et avtalt
erstatningsbeløp, men kan brukes som utgangspunkt hvis gjenstanden blir borte eller ødelagt.

## 4. Leieperiode

Leieperioden er fra **{{period.start}}** til **{{period.end}}**.

Vil dere forlenge leieperioden, må dere avtale det skriftlig i Laandet før perioden er slutt.

## 5. Leiepris og betaling

{{#price.isFree}}
Gjenstanden lånes ut gratis. Leietaker betaler ingen leie.
{{/price.isFree}}
{{^price.isFree}}
Leien er **{{price.amount}} per {{price.unitLabel}}**. For **{{price.units}} {{price.unitLabelPlural}}**
blir det til sammen **{{price.total}}**.
{{/price.isFree}}
{{#handover.deliveryFee}}
Utleier leverer gjenstanden mot et leveringsgebyr på **{{handover.deliveryFee}}**.
{{/handover.deliveryFee}}

Partene avtaler selv hvordan og når de betaler, for eksempel kontant, med Vipps eller med bankoverføring.
**Laandet tar ikke imot og formidler ikke betalinger.** Betalinger utenfor Laandet har ingen beskyttelse fra
Laandet. Betal aldri via lenker du får i meldinger.

## 6. Utlevering og tilbakelevering

- **Utlevering:** {{handover.summary}}
- **Tilbakelevering:** {{return.summary}}

Dere avtaler nøyaktig sted og tidspunkt i meldingene i Laandet. Adressen står ikke i denne avtalen.

## 7. Tilstand ved utlevering

7.1 Ved utleveringen registrerer dere tilstanden i **«Tilstand ved utlevering»** i Laandet. Ta gjerne
bilder.

7.2 Leietakeren skal få undersøke gjenstanden og si fra om skader, feil eller manglende tilbehør
**før** gjenstanden tas med.

7.3 Det dere begge har bekreftet, er utgangspunktet for tilstanden ved utlevering. Hvis bare én av
dere har bekreftet, står det tydelig i rapporten.

## 8. Depositum

{{#deposit.required}}
8.1 Partene har avtalt et depositum på **{{deposit.amount}}**. Leietakeren betaler depositumet direkte til
utleieren, {{deposit.paymentNote}}.

8.2 Utleieren skal betale tilbake depositumet når gjenstanden er levert tilbake.

8.3 Mener utleieren at han eller hun har et krav mot leietakeren, for eksempel fordi gjenstanden er
skadet, tilbehør mangler eller gjenstanden ble levert for sent, må utleieren melde fra om kravet med
**«Meld fra om et problem»** i Laandet **senest {{deadlines.depositClaimHours}} timer etter
tilbakeleveringen**. Utleieren kan da holde tilbake **inntil det beløpet kravet gjelder**. Resten skal
betales tilbake uten unødig opphold.

8.4 Det beløpet som holdes tilbake, skal gjøres opp når dere er enige, eller når saken er avgjort på
annen måte.

8.5 Depositum er ikke en forsikring. Det dekker ikke nødvendigvis hele et eventuelt tap.
**Laandet tar ikke imot, oppbevarer ikke og bestemmer ikke over depositumet.**
{{/deposit.required}}
{{^deposit.required}}
Det er ikke avtalt noe depositum.
{{/deposit.required}}

## 9. Bruk av gjenstanden

9.1 Leietakeren skal bruke gjenstanden forsvarlig og bare til det den er laget for. Leietakeren skal
følge bruksanvisningen og det dere har avtalt om bruken.

{{#permittedUse}}
**Avtalt bruk og begrensninger:** {{permittedUse}}
{{/permittedUse}}
{{#operatingInstructions}}
**Bruksanvisning og råd fra utleier:** {{operatingInstructions}}
{{/operatingInstructions}}
{{#safetyNotice}}
**Sikkerhet:** {{safetyNotice}}
{{/safetyNotice}}

9.2 Leietakeren kan ikke låne ut eller leie ut gjenstanden til andre uten at utleieren har sagt ja.

9.3 Leietakeren skal oppbevare gjenstanden trygt og beskytte den mot tyveri og skade.

9.4 Utleieren skal levere gjenstanden i forsvarlig stand og i samsvar med beskrivelsen. Utleieren skal
også gi den informasjonen om bruk og sikkerhet som leietakeren trenger.

9.5 Hvis gjenstanden virker utrygg eller får en feil, skal leietakeren slutte å bruke den og si fra
til utleieren med en gang.

## 10. Tilbakelevering og normal slitasje

10.1 **Leiegjenstanden skal leveres tilbake i minst like god stand som ved overtakelsen, med unntak av
normal slitasje som følge av avtalt og forsvarlig bruk.**

10.2 Gjenstanden skal være rimelig ren når den leveres tilbake, med mindre dere har avtalt noe annet.
Alt tilbehør skal være med.

10.3 Ved tilbakeleveringen registrerer dere tilstanden i **«Tilstand ved tilbakelevering»** i Laandet.
Hver av dere skriver sine egne observasjoner. Ingen kan endre det den andre har skrevet.

10.4 **Normal slitasje** er små, forventede endringer som skjer når gjenstanden brukes slik dere har
avtalt og på en forsvarlig måte. Eksempler er litt smuss, små bruksmerker og vanlig slitasje på blad
eller batteri. Leietakeren er ikke ansvarlig for normal slitasje.

## 11. Skade, tap og manglende tilbehør

11.1 Leietakeren er **ikke** ansvarlig for skader og feil som fantes da gjenstanden ble overlevert,
for normal slitasje eller for feil som skyldes gjenstandens egen svakhet.

11.2 Leietakeren er ansvarlig for skade, tap og manglende tilbehør som skyldes at leietakeren, eller
noen leietakeren har latt bruke gjenstanden, har vært uaktsom, har brukt gjenstanden på en uforsvarlig
måte eller har brukt den i strid med avtalen.

11.3 Om leietakeren er ansvarlig for skade som skyldes et uhell, kommer an på omstendighetene og
reglene i norsk rett. Leietakeren er ikke automatisk ansvarlig for enhver feil som blir oppdaget
etter tilbakeleveringen.

11.4 Hvis leietakeren er ansvarlig, skal leietakeren dekke rimelige og dokumenterte kostnader til
reparasjon. Kan gjenstanden ikke repareres, eller koster reparasjonen mer enn gjenstanden er verdt,
skal leietakeren dekke verdien gjenstanden hadde rett før skaden eller tapet skjedde. Den oppgitte
verdien i punkt 3 er et utgangspunkt. Det er ikke et fast beløp.

11.5 Skjer det en skade eller et tap, må leietakeren si fra til utleieren så raskt som mulig og bruke
«Meld fra om et problem» i Laandet.

## 12. Forsinket tilbakelevering

12.1 Ser leietakeren at gjenstanden ikke kan leveres tilbake i tide, skal leietakeren si fra til
utleieren så tidlig som mulig.

12.2 Leveres gjenstanden for sent uten at dere har avtalt det, kan utleieren kreve leie for den
ekstra tiden. Leien regnes ut forholdsmessig etter den avtalte prisen. Utleieren kan også kreve dekket
dokumentert tap som skyldes forsinkelsen. Det gjelder ingen andre gebyrer.

12.3 Er gjenstanden ikke levert tilbake innen 24 timer etter at leieperioden var slutt, og leietakeren
ikke har tatt kontakt, kan utleieren registrere den som **«Ikke tilbakelevert»** i Laandet. Mistenker
utleieren tyveri eller underslag, kan han eller hun anmelde forholdet til politiet.

## 13. Avbestilling

Både utleieren og leietakeren kan avbestille i Laandet før gjenstanden er overlevert. Avbestill så
tidlig som mulig. Det kan ikke avtales avbestillingsgebyr i Laandet.

## 14. Problemer og uenighet

14.1 Bruk **«Meld fra om et problem»** i Laandet hvis noe går galt. Meld fra om **synlige
skader og manglende tilbehør innen {{deadlines.visibleDamageHours}} timer** etter tilbakeleveringen.
Meld om **feil som ikke kunne ses ved tilbakeleveringen, innen {{deadlines.hiddenDefectDays}} dager**.
Fristene gjelder saksbehandlingen i Laandet. De begrenser ikke rettighetene dere har etter norsk lov.

14.2 Partene skal først prøve å bli enige. Laandet kan hjelpe dere med å få oversikt over saken og
foreslå en løsning. Laandet kan ikke ta en bindende avgjørelse. Les [Retningslinjer for
tvister](retningslinjer-for-tvister.md).

14.3 Blir dere ikke enige, kan saken bringes inn for **forliksrådet**. Ved mistanke om tyveri eller
svindel kan forholdet anmeldes til **politiet**.

## 15. Lagring av avtalen

Laandet lagrer avtalen, godkjenningene, tilstandsrapportene og historikken for leieforholdet i
**3 år etter at leieforholdet er avsluttet**. Hvis en sak fortsatt pågår, lagres opplysningene til saken
er avsluttet. Les mer i [personvernerklæringen](personvernerklaering.md).

## 16. Norsk rett

Norsk rett gjelder for avtalen.

## 17. Godkjenning

Partene godtar avtalen elektronisk i Laandet ved å trykke **«Jeg godtar avtalen»**. Laandet lagrer
tidspunktet for hver godkjenning og en kontrollsum (SHA-256) av avtaleteksten slik den ble vist.

Avtalen gjelder når begge parter har godtatt den. Hvis dere endrer noe vesentlig, for eksempel tid, pris,
depositum, utleverings- eller tilbakeleveringsmåte, tilbehør eller avtalt bruk, lages det en ny
versjon av avtalen. Den nye versjonen må godtas av dere begge.

*Godkjenningene står under avtalen i Laandet.*
