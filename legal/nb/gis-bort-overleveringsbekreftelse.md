---
doc_key: giveaway_transfer
locale: nb
version: 0.1.0-utkast
status: UTKAST – ikke juridisk gjennomgått
updated: 25.10.2026
template_syntax: Mustache (logikkløs)
---

> **UTKAST – IKKE JURIDISK GJENNOMGÅTT.** Dette er et førsteutkast laget med hjelp av KI. Det må
> gjennomgås av en kvalifisert norsk jurist før det tas i bruk.

# Gis bort – overleveringsbekreftelse

**Nummer:** {{agreementNumber}} · **Mal:** Overleveringsbekreftelse {{templateVersion}}

Denne bekreftelsen viser at en gjenstand er gitt bort **gratis og for godt**. Det er ikke en leieavtale.
Laandet er ikke part i overleveringen og tar ikke betalt for den.

## 1. Partene

| | Visningsnavn | Laandet-ID |
|---|---|---|
| **Giver** | {{giver.displayName}} | {{giver.platformId}} |
| **Mottaker** | {{recipient.displayName}} | {{recipient.platformId}} |

## 2. Gjenstanden

- **Gjenstand:** {{item.title}}
- **Beskrivelse:** {{item.description}}
- **Tilstand:** {{item.condition}}
- **Kjente feil og mangler:** {{item.knownDefects}}

## 3. Overlevering

- **Måte:** {{handover.summary}}
- **Dato:** {{handover.date}}

## 4. Hva begge bekrefter

**Giveren bekrefter at**

- han eller hun eier gjenstanden og har rett til å gi den bort,
- beskrivelsen og de kjente feilene over stemmer med det giveren vet,
- gjenstanden ikke er beskrevet som trygg eller i orden hvis giveren vet at den er ødelagt eller farlig.

**Mottakeren bekrefter at**

- han eller hun har fått gjenstanden og har hatt mulighet til å se på den,
- han eller hun tar imot gjenstanden **som den er**, med de feilene som er beskrevet over.

Gjenstanden gis bort gratis. Ingen av partene skal betale noe for den. Eierskap og ansvar for
gjenstanden går over til mottakeren ved overleveringen.

At gjenstanden tas imot «som den er», fritar ikke giveren for ansvar hvis giveren har holdt tilbake
feil han eller hun visste om, eller har gitt uriktige opplysninger.

## 5. Bekreftelse

Partene bekrefter overleveringen elektronisk i Laandet. Laandet lagrer tidspunktet for hver bekreftelse
og en kontrollsum (SHA-256) av teksten. Bekreftelsen lagres i 3 år.

*Bekreftelsene står under teksten i Laandet.*
