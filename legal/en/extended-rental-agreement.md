---
doc_key: rental_extended
locale: en
version: 0.1.0-utkast
status: DRAFT – not legally reviewed · NOT IN USE IN THE PILOT PHASE – informational translation
updated: 25.10.2026
applies_to: declared value > 5 000 kr (> 500 000 øre)
template_syntax: Mustache (logic-less), as in simplified-rental-agreement.md
translation_of: legal/nb/utvidet-leieavtale.md
---

<!--
DEVELOPER NOTE:
- The template cannot be put into use until these prerequisites are in place (DECISIONS D-011):
  (1) strong identity verification (BankID or equivalent) for both parties,
  (2) a legally assessed arrangement for the deposit, preferably through an approved payment service,
  (3) the `extended_agreements` flag is turned on, and the database constraint `mvp_category_a_only` has been removed with a migration.
- The acceptances are not part of the text (see simplified-rental-agreement.md).
-->

> **DRAFT – NOT LEGALLY REVIEWED – NOT IN USE.** Renting out items with a declared value above
> 5 000 kr is not yet open in Laandet. This template is a first draft made with the help of AI, and it must
> be approved by a qualified Norwegian lawyer before it can be used.

# Extended rental agreement

> **Informational translation.** The Norwegian version of this document is the legally binding one. If the two versions differ, the Norwegian text prevails.

**Agreement number:** {{agreementNumber}} · **Version of the agreement:** {{revision}} · **Template:** Extended rental agreement {{templateVersion}}

This agreement applies to renting an item with a declared value of **more than 5 000 kr**. The agreement is made between
the owner and the renter. **Laandet is not a party to the agreement.**

## In short

- You are renting **{{item.title}}** from **{{period.start}}** to **{{period.end}}**.
- The rent is **{{price.total}}**. The deposit is **{{deposit.amount}}** and is mandatory.
- Both parties have verified their identity with {{identity.providerLabel}}.
- Photos at handover and at return are mandatory.
- The rented item must be returned in at least as good condition as at handover, except for normal wear and tear resulting from agreed and proper use. (*«Leiegjenstanden skal leveres tilbake i minst like god stand som ved overtakelsen, med unntak av normal slitasje som følge av avtalt og forsvarlig bruk.»*)
- **The deposit is not insurance and does not necessarily cover the whole of any loss.**

## Part A – Basic terms

Sections 1–17 of Laandet's **simplified rental agreement** ({{baseTemplateVersion}}) also apply to this
agreement. They are set out in full below. Where Part B says something different, Part B applies.

{{> simplified-rental-agreement-core}}

<!-- The renderer inserts sections 1–17 from simplified-rental-agreement.md here, without the introduction and “In short”. -->

## Part B – Additional terms for items with a value above 5 000 kr

### B1. Mandatory deposit

B1.1 The parties have agreed on a deposit of **{{deposit.amount}}**. {{deposit.paymentNote}}

B1.2 The deposit must be provided before the item is handed over. If the deposit has not been provided, the owner
is not obliged to hand over the item.

B1.3 The deposit is not the same as the item's value. It is not insurance, and it does not
necessarily cover the whole of any loss.

B1.4 The rules for repayment and withholding are set out in section B13.

### B2. Identity verification

Both parties have verified their identity with **{{identity.providerLabel}}**:

- the owner on {{identity.ownerVerifiedAt}},
- the renter on {{identity.renterVerifiedAt}}.

Laandet does not store national identity numbers (fødselsnummer).

### B3. Detailed condition checklist

Before handover, the owner must fill in a detailed condition checklist in Laandet. The checklist must describe:

- the general condition,
- all visible damage, scratches and dents, and where they are,
- wear parts and how worn they are (for example tyres, blade, chain and battery),
- cleanliness,
- the fuel or battery level, if relevant.

The renter must go through the checklist together with the owner, and may add their own remarks or dispute
items before handover.

### B4. Mandatory photos at handover

Before handover, **at least {{photos.minimum}} photos** must be uploaded showing the item from
several sides. Known damage and any serial number must also be included in the photos. The item is not
handed over until the photos have been uploaded.

### B5. Mandatory photos at return

At return, **at least {{photos.minimum}} photos** must be uploaded in the same way.

If it is not possible to take photos, for example because there is no phone or it is completely dark, the
person registering the return must write why in Laandet. The photos must then be taken as soon as
possible, and no later than 24 hours after the return.

### B6. Serial number and identifying marks

{{#item.identifier}}The item has the serial number or identifying mark **{{item.identifier}}**. The parties
check it at handover and at return.{{/item.identifier}}
{{^item.identifier}}The item does not have a serial number. In the condition checklist, the parties describe
identifying marks that make it possible to recognise it.{{/item.identifier}}

### B7. Function test and check of accessories

At handover, the parties test together that the item works as it should. The test is described in
the condition checklist. The parties also check that all the accessories are included. The same is done at
return.

### B8. Special restrictions on use

{{#permittedUse}}{{permittedUse}}{{/permittedUse}}
{{^permittedUse}}No special restrictions beyond section 9 in Part A.{{/permittedUse}}

The item may not be taken out of Norway unless the owner has said yes in writing.

### B9. Requirements for use and safety

{{#safetyNotice}}{{safetyNotice}}{{/safetyNotice}}

The renter confirms that he or she has the experience, the protective equipment and, where relevant, the
driving licence or certificate needed to use the item safely and lawfully. The owner must
give an introduction to using the item at handover.

### B10. Insurance

{{#insurance.note}}{{insurance.note}}{{/insurance.note}}
{{^insurance.note}}The parties have not provided information about any insurance that covers the item during the rental period.{{/insurance.note}}

Laandet has no insurance that covers the users. The parties should check for themselves what their own insurance
covers.

### B11. Reporting damage and documentation

B11.1 If damage, a fault or a loss occurs during the rental period, the renter must immediately:

1. stop using the item if it is unsafe to use,
2. tell the owner,
3. report it in Laandet using “Report a problem” within **24 hours** and upload photos,
4. in the event of theft, report the matter to the police and upload the confirmation of the police report.

B11.2 An owner who wants to claim compensation must document the claim with photos and a description. If
possible, the owner must also attach a quote or a receipt for the repair.

### B12. Confirmation of return

The return is confirmed when both parties have confirmed the condition at return in Laandet,
with photos as described in section B5. If one party does not confirm, this is clearly stated in the report. It is then
not regarded as a joint confirmation.

### B13. Repayment of the deposit and disagreement

B13.1 The owner must pay back the deposit when the return has been confirmed without deviations.

B13.2 If the owner believes that he or she has a claim, the claim must be reported in Laandet within
**{{deadlines.depositClaimHours}} hours** after the return. The claim must be specific and state an amount.
The owner may withhold up to the amount the claim concerns. The rest must be paid back without undue
delay.

B13.3 The amount that is withheld is settled when the parties agree. It can also be settled when
the conciliation board (forliksrådet) or the courts have decided the matter. **Laandet does not decide who gets the
deposit.**

{{#deposit.providerManaged}}B13.4 The deposit is handled by {{deposit.providerName}}. Payout takes place according to
the terms described in Laandet.{{/deposit.providerManaged}}

### B14. Item that is not returned, and suspected theft

B14.1 If the item has not been returned within 24 hours after the rental period ended, and
the renter has not made contact, the owner may register it as **“Not returned”** in Laandet.
Laandet then notifies the renter.

B14.2 If the renter still does not return the item or make contact, the owner may report
the matter to the police. Laandet may restrict the renter's account while the case is ongoing. Laandet may also
disclose information to the police when the police ask for it and the law permits it.

B14.3 A registration that the item has not been returned, or a police report, is **not** proof
that anyone has committed a criminal offence. Laandet never shows such cases publicly.

## Acceptance

The agreement applies once both parties have accepted it in Laandet. If you change anything significant, you must
both accept the agreement again. Laandet stores the time of each acceptance and a checksum (SHA-256)
of the agreement text.

*The acceptances are shown below the agreement in Laandet.*
