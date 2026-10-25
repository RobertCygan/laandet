---
doc_key: rental_simple
locale: en
version: 0.1.0-utkast
status: DRAFT – not legally reviewed – informational translation
updated: 25.10.2026
applies_to: declared value ≤ 5 000 kr (≤ 500 000 øre)
template_syntax: Mustache (logic-less). {{field}} = value, {{#field}}…{{/field}} = shown if set, {{^field}}…{{/field}} = shown if not set. All values are inserted as plain text.
translation_of: legal/nb/forenklet-leieavtale.md
---

<!--
DEVELOPER NOTE (not shown to users):
- The template is filled in on the server from a ContractTerms object (docs/RENTAL_AGREEMENTS.md §2).
- Amounts are formatted as “1 500 kr” and dates as “14.12.2026 kl. 10:00” (Europe/Oslo).
- The acceptances are NOT part of the text. They are shown below the agreement, so that the checksum (SHA-256)
  of the text does not change when a party accepts.
-->

> **DRAFT – NOT LEGALLY REVIEWED.** This template is a first draft made with the help of AI. It must not
> be used for real agreements until a qualified Norwegian lawyer has approved it.

# Simplified rental agreement

> **Informational translation.** The Norwegian version of this document is the legally binding one. If the two versions differ, the Norwegian text prevails.

**Agreement number:** {{agreementNumber}} · **Version of the agreement:** {{revision}} · **Template:** Simplified rental agreement {{templateVersion}}

This agreement applies to renting or lending out an item with a declared value of **5 000 kr or less**. The
agreement is made between the owner and the renter. **Laandet is not a party to the agreement.** Laandet only
provides the service in which the agreement is made and documented.

## In short

- You are renting **{{item.title}}** from **{{period.start}}** to **{{period.end}}**.
- {{#price.isFree}}The item is lent out **free of charge**.{{/price.isFree}}{{^price.isFree}}The rent is **{{price.total}}**. It is paid directly between you.{{/price.isFree}}
- Deposit: **{{deposit.summary}}**
- Handover: **{{handover.summary}}** · Return: **{{return.summary}}**
- The rented item must be returned in at least as good condition as at handover, except for normal wear and tear resulting from agreed and proper use. (*«Leiegjenstanden skal leveres tilbake i minst like god stand som ved overtakelsen, med unntak av normal slitasje som følge av avtalt og forsvarlig bruk.»*)
- If something happens, tap **“Report a problem”** in Laandet.
- Laandet does not accept money and never sends payment links.

## 1. The parties

| | Display name | Laandet ID |
|---|---|---|
| **Owner** | {{owner.displayName}} | {{owner.platformId}} |
| **Renter** | {{renter.displayName}} | {{renter.platformId}} |

Both parties have themselves confirmed that they are at least 18 years old, and that they are entering into the
agreement as private individuals. The parties have confirmed their email address in Laandet. **Their identity has
not been checked with BankID or any other proof of identity.**

## 2. The rented item

- **Item:** {{item.title}}
- **Category:** {{item.categoryLabel}}
- **Description:** {{item.description}}
{{#item.identifier}}- **Serial number or identifying marks:** {{item.identifier}}
{{/item.identifier}}- **Condition according to the listing:** {{item.condition}}
- **Known faults and defects:** {{#item.knownDefects}}{{item.knownDefects}}{{/item.knownDefects}}{{^item.knownDefects}}None stated{{/item.knownDefects}}

**Accessories included:**
{{#accessories}}
- {{.}}
{{/accessories}}
{{^accessories}}
- No accessories have been stated.
{{/accessories}}

## 3. Declared value

The owner estimates that it costs about **{{declaredValue}}** to obtain an equivalent item.
The value is the owner's own estimate. Laandet has not checked it. Nor is the value an agreed
compensation amount, but it can be used as a starting point if the item is lost or broken.

## 4. Rental period

The rental period is from **{{period.start}}** to **{{period.end}}**.

If you want to extend the rental period, you must agree on this in writing in Laandet before the period ends.

## 5. Rent and payment

{{#price.isFree}}
The item is lent out free of charge. The renter pays no rent.
{{/price.isFree}}
{{^price.isFree}}
The rent is **{{price.amount}} per {{price.unitLabel}}**. For **{{price.units}} {{price.unitLabelPlural}}**
this comes to a total of **{{price.total}}**.
{{/price.isFree}}
{{#handover.deliveryFee}}
The owner delivers the item for a delivery fee of **{{handover.deliveryFee}}**.
{{/handover.deliveryFee}}

The parties agree between themselves how and when to pay, for example in cash, with Vipps or by bank transfer.
**Laandet does not receive or pass on payments.** Payments outside Laandet have no protection from
Laandet. Never pay via links you receive in messages.

## 6. Handover and return

- **Handover:** {{handover.summary}}
- **Return:** {{return.summary}}

You agree on the exact place and time in the messages in Laandet. The address is not included in this agreement.

## 7. Condition at handover

7.1 At handover, you record the condition in **“Condition at handover”** in Laandet. Feel free to take
photos.

7.2 The renter must be allowed to examine the item and point out any damage, faults or missing accessories
**before** the item is taken away.

7.3 What you have both confirmed is the starting point for the condition at handover. If only one of
you has confirmed, this is clearly stated in the report.

## 8. Deposit

{{#deposit.required}}
8.1 The parties have agreed on a deposit of **{{deposit.amount}}**. The renter pays the deposit directly to
the owner, {{deposit.paymentNote}}.

8.2 The owner must pay back the deposit when the item has been returned.

8.3 If the owner believes that he or she has a claim against the renter, for example because the item is
damaged, accessories are missing or the item was returned late, the owner must report the claim using
**“Report a problem”** in Laandet **no later than {{deadlines.depositClaimHours}} hours after
the return**. The owner may then withhold **up to the amount the claim concerns**. The rest must be
paid back without undue delay.

8.4 The amount that is withheld must be settled when you agree, or when the matter has been decided in
some other way.

8.5 A deposit is not insurance. It does not necessarily cover the whole of any loss.
**Laandet does not receive, hold or make decisions about the deposit.**
{{/deposit.required}}
{{^deposit.required}}
No deposit has been agreed.
{{/deposit.required}}

## 9. Use of the item

9.1 The renter must use the item properly and only for what it is made for. The renter must
follow the instructions for use and what you have agreed about its use.

{{#permittedUse}}
**Agreed use and restrictions:** {{permittedUse}}
{{/permittedUse}}
{{#operatingInstructions}}
**Instructions for use and advice from the owner:** {{operatingInstructions}}
{{/operatingInstructions}}
{{#safetyNotice}}
**Safety:** {{safetyNotice}}
{{/safetyNotice}}

9.2 The renter may not lend or rent out the item to others unless the owner has said yes.

9.3 The renter must store the item safely and protect it against theft and damage.

9.4 The owner must provide the item in proper condition and in accordance with the description. The owner must
also give the information about use and safety that the renter needs.

9.5 If the item seems unsafe or develops a fault, the renter must stop using it and tell
the owner immediately.

## 10. Return and normal wear and tear

10.1 **The rented item must be returned in at least as good condition as at handover, except for normal wear and tear resulting from agreed and proper use.** (*«Leiegjenstanden skal leveres tilbake i minst like god stand som ved overtakelsen, med unntak av normal slitasje som følge av avtalt og forsvarlig bruk.»*)

10.2 The item must be reasonably clean when it is returned, unless you have agreed otherwise.
All accessories must be included.

10.3 At return, you record the condition in **“Condition at return”** in Laandet.
Each of you writes your own observations. No one can change what the other has written.

10.4 **Normal wear and tear** means small, expected changes that happen when the item is used as you have
agreed and in a proper way. Examples are a little dirt, small marks from use and ordinary wear on a blade
or battery. The renter is not responsible for normal wear and tear.

## 11. Damage, loss and missing accessories

11.1 The renter is **not** responsible for damage and faults that existed when the item was handed over,
for normal wear and tear, or for faults caused by a weakness in the item itself.

11.2 The renter is responsible for damage, loss and missing accessories caused by the renter, or
anyone the renter has let use the item, having been negligent, having used the item in an improper
way or having used it in breach of the agreement.

11.3 Whether the renter is responsible for damage caused by an accident depends on the circumstances and
the rules of Norwegian law. The renter is not automatically responsible for every fault that is discovered
after the return.

11.4 If the renter is responsible, the renter must cover reasonable and documented repair
costs. If the item cannot be repaired, or the repair costs more than the item is worth,
the renter must cover the value the item had immediately before the damage or loss occurred. The declared
value in section 3 is a starting point. It is not a fixed amount.

11.5 If damage or a loss occurs, the renter must tell the owner as soon as possible and use
“Report a problem” in Laandet.

## 12. Late return

12.1 If the renter sees that the item cannot be returned on time, the renter must tell
the owner as early as possible.

12.2 If the item is returned late without you having agreed to it, the owner may claim rent for the
extra time. The rent is calculated proportionally based on the agreed price. The owner may also claim
compensation for documented loss caused by the delay. No other fees apply.

12.3 If the item has not been returned within 24 hours after the rental period ended, and the renter
has not made contact, the owner may register it as **“Not returned”** in Laandet. If the owner suspects
theft or embezzlement, he or she may report the matter to the police.

## 13. Cancellation

Both the owner and the renter may cancel in Laandet before the item has been handed over. Cancel as
early as possible. No cancellation fee can be agreed in Laandet.

## 14. Problems and disagreement

14.1 Use **“Report a problem”** in Laandet if something goes wrong. Report **visible
damage and missing accessories within {{deadlines.visibleDamageHours}} hours** after the return.
Report **faults that could not be seen at the return, within {{deadlines.hiddenDefectDays}} days**.
The deadlines apply to case handling in Laandet. They do not limit the rights you have under Norwegian law.

14.2 The parties must first try to reach agreement. Laandet can help you get an overview of the matter and
suggest a solution. Laandet cannot make a binding decision. Read the [Dispute
guidelines](dispute-guidelines.md).

14.3 If you do not reach agreement, the matter can be brought before **the conciliation board (forliksrådet)**. If theft or
fraud is suspected, the matter can be reported to **the police**.

## 15. Storage of the agreement

Laandet stores the agreement, the acceptances, the condition reports and the history of the rental for
**3 years after the rental has ended**. If a case is still ongoing, the information is stored until the case
is closed. Read more in the [privacy notice](privacy-notice.md).

## 16. Norwegian law

Norwegian law applies to the agreement.

## 17. Acceptance

The parties accept the agreement electronically in Laandet by tapping **“I accept the agreement”**. Laandet stores
the time of each acceptance and a checksum (SHA-256) of the agreement text as it was displayed.

The agreement applies once both parties have accepted it. If you change anything significant, for example the time, price,
deposit, method of handover or return, accessories or agreed use, a new
version of the agreement is created. The new version must be accepted by both of you.

*The acceptances are shown below the agreement in Laandet.*
