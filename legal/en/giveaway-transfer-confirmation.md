---
doc_key: giveaway_transfer
locale: en
version: 0.1.0-utkast
status: DRAFT – not legally reviewed – informational translation
updated: 25.10.2026
template_syntax: Mustache (logic-less)
translation_of: legal/nb/gis-bort-overleveringsbekreftelse.md
---

> **DRAFT – NOT LEGALLY REVIEWED.** This is a first draft made with the help of AI. It must be
> reviewed by a qualified Norwegian lawyer before it is put into use.

# Giving away – transfer confirmation

> **Informational translation.** The Norwegian version of this document is the legally binding one. If the two versions differ, the Norwegian text prevails.

**Number:** {{agreementNumber}} · **Template:** Transfer confirmation {{templateVersion}}

This confirmation shows that an item has been given away **free of charge and for good**. It is not a rental agreement.
Laandet is not a party to the handover and does not charge for it.

## 1. The parties

| | Display name | Laandet ID |
|---|---|---|
| **Giver** | {{giver.displayName}} | {{giver.platformId}} |
| **Recipient** | {{recipient.displayName}} | {{recipient.platformId}} |

## 2. The item

- **Item:** {{item.title}}
- **Description:** {{item.description}}
- **Condition:** {{item.condition}}
- **Known faults and defects:** {{item.knownDefects}}

## 3. Handover

- **Method:** {{handover.summary}}
- **Date:** {{handover.date}}

## 4. What both parties confirm

**The giver confirms that**

- he or she owns the item and has the right to give it away,
- the description and the known faults above match what the giver knows,
- the item has not been described as safe or in good order if the giver knows that it is broken or dangerous.

**The recipient confirms that**

- he or she has received the item and has had the opportunity to look at it,
- he or she accepts the item **as it is**, with the faults described above.

The item is given away free of charge. Neither party is to pay anything for it. Ownership of and responsibility for
the item pass to the recipient at the handover.

The fact that the item is accepted “as it is” does not release the giver from responsibility if the giver has withheld
faults he or she knew about, or has given incorrect information.

## 5. Confirmation

The parties confirm the handover electronically in Laandet. Laandet stores the time of each confirmation
and a checksum (SHA-256) of the text. The confirmation is stored for 3 years.

*The confirmations are shown below the text in Laandet.*
