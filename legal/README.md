# Laandet — Legal document drafts

> **None of these documents is legally reviewed or approved.** They are first drafts prepared with AI
> assistance (25.10.2026). They must be reviewed by a qualified Norwegian lawyer before they are used with
> real users. See [`../docs/LEGAL_REVIEW_CHECKLIST.md`](../docs/LEGAL_REVIEW_CHECKLIST.md).

- **Norwegian (`nb/`) is authoritative.**
- **English (`en/`)** files are informational translations. Each one says the Norwegian text prevails.
- Placeholders `[MÅ FYLLES UT FØR LANSERING]` and `[KONTROLLERES FØR LANSERING]` mark information that
  must be supplied or verified. The production legal loader refuses texts that still contain them (task P01-11).

| Document | Norsk (authoritative) | English (informational) | In use in the pilot? |
|---|---|---|---|
| Terms of use | [brukervilkar.md](nb/brukervilkar.md) | [terms-of-use.md](en/terms-of-use.md) | yes |
| Privacy notice | [personvernerklaering.md](nb/personvernerklaering.md) | [privacy-notice.md](en/privacy-notice.md) | yes |
| Cookies | [informasjonskapsler.md](nb/informasjonskapsler.md) | [cookies.md](en/cookies.md) | yes |
| Simplified rental agreement (≤ 5 000 kr) | [forenklet-leieavtale.md](nb/forenklet-leieavtale.md) | [simplified-rental-agreement.md](en/simplified-rental-agreement.md) | yes (template) |
| Extended rental agreement (> 5 000 kr) | [utvidet-leieavtale.md](nb/utvidet-leieavtale.md) | [extended-rental-agreement.md](en/extended-rental-agreement.md) | **no**: blocked until BankID and the deposit procedure exist |
| Giveaway transfer confirmation | [gis-bort-overleveringsbekreftelse.md](nb/gis-bort-overleveringsbekreftelse.md) | [giveaway-transfer-confirmation.md](en/giveaway-transfer-confirmation.md) | yes (template) |
| Dispute guidelines | [retningslinjer-for-tvister.md](nb/retningslinjer-for-tvister.md) | [dispute-guidelines.md](en/dispute-guidelines.md) | yes |
| Prohibited and restricted items | [forbudte-og-begrensede-gjenstander.md](nb/forbudte-og-begrensede-gjenstander.md) | [prohibited-and-restricted-items.md](en/prohibited-and-restricted-items.md) | yes |
| Safe rental guidelines | [retningslinjer-for-trygg-utleie.md](nb/retningslinjer-for-trygg-utleie.md) | [safe-rental-guidelines.md](en/safe-rental-guidelines.md) | yes |
| «Støtt Laandet» page text | [stott-laandet.md](nb/stott-laandet.md) | [support-laandet.md](en/support-laandet.md) | yes (no link until a real campaign exists) |

The agreement templates use logic-less Mustache tags (`{{…}}`). See
[`../docs/RENTAL_AGREEMENTS.md`](../docs/RENTAL_AGREEMENTS.md) §2 for the view model.
