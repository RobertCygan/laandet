# Laandet — Legal Review Checklist

**Status:** Phase 00. Nothing in this repository is legally approved.

**Purpose:**
- Give a Norwegian lawyer a focused list of questions.
- Keep three categories apart: **verified** facts, **assumptions** and **open questions**.

**Research method and its limits:** On 25.10.2026 an AI research assistant searched primary sources. It could not open
lovdata.no, regjeringen.no or stortinget.no directly (network/DNS restriction in the build environment). Findings
therefore rest on **search-engine excerpts of primary sources**. Treat every "Verified (excerpt)" item as needing a
direct check of the current text on Lovdata before launch.

Legend:

| Label | Meaning |
|---|---|
| **V** | Verified from a primary source excerpt |
| **A** | Assumption |
| **Q** | Open question for the lawyer |

## 1. Documents to review

| Doc | File (authoritative nb) | Review status |
|---|---|---|
| Brukervilkår | `legal/nb/brukervilkar.md` | ☐ not reviewed |
| Personvernerklæring | `legal/nb/personvernerklaering.md` | ☐ not reviewed |
| Informasjonskapsler | `legal/nb/informasjonskapsler.md` | ☐ not reviewed |
| Forenklet leieavtale (≤ 5 000 kr) | `legal/nb/forenklet-leieavtale.md` | ☐ not reviewed |
| Utvidet leieavtale (> 5 000 kr, not used in pilot) | `legal/nb/utvidet-leieavtale.md` | ☐ not reviewed (can wait until Phase 05) |
| Gis bort – overleveringsbekreftelse | `legal/nb/gis-bort-overleveringsbekreftelse.md` | ☐ not reviewed |
| Retningslinjer for tvister | `legal/nb/retningslinjer-for-tvister.md` | ☐ not reviewed |
| Forbudte og begrensede gjenstander | `legal/nb/forbudte-og-begrensede-gjenstander.md` | ☐ not reviewed |
| Retningslinjer for trygg utleie | `legal/nb/retningslinjer-for-trygg-utleie.md` | ☐ not reviewed |
| Støtt Laandet (page text) | `legal/nb/stott-laandet.md` | ☐ not reviewed |
| English translations | `legal/en/*` | ☐ check consistency; mark as informational |

## 2. Requirement-by-requirement

### L-01 Operator identity and information duties (ehandelsloven § 8)
- **V (excerpt):** Lov 23.05.2003 nr. 35 § 8 requires service providers to give easily and directly accessible information:
  - name, geographic address, email address and other details for quick contact
  - register and organisation number
  - VAT number if any
  - any licence and the authority that issued it

  Preparatory works recommend a link from every page.
- **Action:** Fill in all `MÅ FYLLES UT FØR LANSERING` fields. Put a footer link «Om Laandet / Kontakt» on every page.
- **Q:** Which G-PSI.ai legal entity operates Laandet (AS / ENK)? Is it registered in Enhetsregisteret?

### L-02 Digital Services Act (DSA)
- **V (excerpt):**
  - The DSA is **not yet part of Norwegian law**: Stortinget EU/EØS-nytt 05.06.2026 and Nkom's 2026 report.
  - A draft *digitaltjenesteloven* was on consultation 02.07–01.10.2025. Nkom is the planned coordinator.
  - No adopted act was found up to August 2026.
- **A:** Laandet is designed as if the DSA hosting duties applied, because the rules are coming and they are good practice:
  - art. 11–14: points of contact and clear terms
  - art. 16: notice-and-action
  - art. 17: statement of reasons
  - art. 18: notification of suspected criminal offences threatening life or safety
- **A:** G-PSI.ai qualifies as a micro/small enterprise, so the exemptions in art. 19 and art. 29 apply once the DSA is in force (no internal complaint-handling obligation under art. 20, no trader traceability). Laandet still offers appeals voluntarily.
- **Q:**
  - Status of the Norwegian act at launch.
  - Any Norwegian additions, such as a duty to report possible crimes to the police.
  - Confirm micro/small status.

### L-03 Online marketplace duties (Omnibus implementation)
- **V (excerpt):**
  - The Omnibus directive is implemented by lov 16.06.2023 nr. 38, in force **01.10.2023**.
  - **Angrerettloven § 9 a:** online marketplaces must state the main ranking parameters, and whether the third party is a trader, based on that party's own declaration.
  - **Markedsføringsloven § 8:** ranking information is material where consumers search offers from traders *or consumers*. If reviews are shown, the marketplace must say whether and how it ensures they come from real users.
- **Implemented in drafts:**
  - Brukervilkår §7 (ranking), §8 («Privatperson» label based on own declaration), §18.2 (how review authenticity is ensured).
  - Ranking explanation also on the explore page.
- **Q:**
  - Do these duties apply when **all** users are private persons?
  - Is our wording sufficient?
  - Must the ranking explanation be on a page "directly accessible from the search results"? (Planned: yes.)

### L-04 Privacy (GDPR / personopplysningsloven)
- **V (excerpt):** Personopplysningsloven (lov 15.06.2018 nr. 38) incorporates the GDPR. Datatilsynet is the supervisory authority.
- **A:** The legal bases, retention periods and deletion procedure are as in `PRIVACY.md`.
- **Q:**
  - Legal basis for dispute facilitation and moderation of reported messages (6(1)(f) vs 6(1)(b)).
  - 3-year retention of agreements and condition reports, based on the general limitation period in foreldelsesloven § 2.
  - Retaining the display name in agreements after account deletion.
  - Inactive-account deletion after 24 + 2 months.
  - Processor agreements and transfer assessment for Sentry (US company, EU data region) and, if enabled, Cloudflare Turnstile.

### L-05 Cookies (ekomloven § 3-15)
- **V (excerpt):**
  - New ekomloven (lov 13.12.2024 nr. 76), in force 01.01.2025.
  - Storing or reading information on the user's device requires GDPR-standard consent, except where strictly necessary for a service the user explicitly requested. Nkom interprets this exception narrowly.
  - Datatilsynet published consent guidance in 2025.
- **A:** These need no consent: session cookies, the short-lived session cache, the 2FA step cookie and the language preference cookie (`NEXT_LOCALE`).
- **Q:**
  - Is the language preference cookie covered by the exemption, or should the language be kept only in the URL and the user profile?
  - Turnstile, if ever enabled.

### L-06 Contract law for the rental agreements
- **A:**
  - No specific statute governs rental of movables between private persons.
  - General contract law applies, including avtaleloven § 36 (setting aside unreasonable terms).
  - Non-statutory principles on rental and lending of movables also apply. Free lending is treated as *lån*.
- **Q (important):**
  1. Is the renter's liability standard (negligence, improper use, use contrary to the agreement; accidents depend on circumstances) correctly expressed?
  2. **Burden of proof** for damage that occurred while the item was in the renter's possession: should the agreement say anything?
  3. Compensation measure: repair cost, or value immediately before the damage. Is the declared value only a "starting point"?
  4. Late return: proportional extra rent plus documented loss. Is that reasonable and enforceable?
  5. Deposit retention rule: claim notice within 48 h, retention capped at the claimed amount.
  6. The "48 h / 14 days" Laandet case deadlines and the wording that they do not limit statutory rights.
  7. Does free lending (price 0) need different liability wording?
  8. Electronic acceptance (button + hash) as valid formation and evidence.

### L-07 Platform reporting to the tax authority (DPI)
- **V (excerpt):**
  - Skatteforvaltningsloven § 7-11 and forskrift FOR-2025-06-25-1310, in force 01.01.2026, first reporting year 2026.
  - Covers rental of real estate, personal services and **rental of means of transport**.
  - Reporting applies where the consideration is known, or can reasonably be expected to be known, to the platform.
  - First reports are due 31.01.2027.
- **Unclear:**
  - Whether trailers, bicycles, e-scooters, kayaks, canoes and SUP boards count as "transportmidler".
  - Whether a platform that records the agreed price, but does not process payment, "knows" the consideration.
  - Whether sale of goods is covered.
- **Interim design (D-028):** paid rental is off for `tilhengere`, `sykler` and `padling` (free lending and giveaway allowed). Rental of real estate and services is prohibited (D-028, PROHIBITED_ITEMS §3).
- **Q:**
  - Is Laandet a reporting platform operator?
  - Can it document "no reportable sellers" for an exemption?
  - Should we request a **binding advance ruling (bindende forhåndsuttalelse)** from Skatteetaten?

### L-08 Payment services (no money flows in the MVP)
- **V (excerpt):**
  - Under finansforetaksloven §§ 2-3 and 2-4, payment services and e-money require a licence (bank, betalingsforetak, e-pengeforetak) or acting as an agent of a licensed provider.
  - Holding renters' deposits or escrow would very likely be a licensable service.
- **Design:** Laandet records agreed amounts only, never receives or holds money, and shows no payment links (D-012).
- **Q:**
  - Confirm that recording the agreed price and deposit as contract terms, with off-platform payment, needs no licence.
  - Before Phase 05: choose a provider model (agent of a licensed provider, or a licensed provider's marketplace product).

### L-09 Consumer dispute bodies and courts
- **V (excerpt):**
  - Since 2021, mediation under forbrukerklageloven is done by **Forbrukertilsynet**.
  - Its private-to-private jurisdiction covers **purchase and sale of goods**, not rental or lending.
  - Forliksrådet (tvisteloven ch. 6) is the normal first instance for small civil claims.
  - **Rettsgebyr 2026 = 1 345 kr** (FOR-2025-12-17-2649). The forliksråd fee is quoted as **1.54 × R ≈ 2 071 kr**.
- **Action:** The dispute guidelines refer private rental disputes to forliksrådet and police, not to Forbrukertilsynet. The fee amount is marked `[KONTROLLERES FØR LANSERING]`.
- **Q:**
  - Confirm the jurisdiction statement.
  - Confirm the current forliksråd fee.
  - Is there a public authority to name for reporting dangerous products (DSB / Forbrukertilsynet)?

### L-10 Age (vergemålsloven)
- **V (excerpt):** Vergemålsloven § 2 defines a minor as under 18. Under § 9, minors cannot enter legal transactions unless the law provides otherwise.
- **Design:** 18+ self-declaration at sign-up, never shown as verified.
- **Q:** Is self-declaration sufficient for the pilot, given that real verification would need BankID?

### L-11 Platform liability and terms of use
- **A:**
  - Liability limitations in Brukervilkår §17 respect mandatory law (no exclusion for intent or gross negligence).
  - The ehandelsloven §§ 16–18 hosting safe harbour applies until the DSA (art. 6) replaces it.
- **Q:**
  - Is §17 balanced and enforceable under avtaleloven § 36 and markedsføringsloven § 22 (unfair standard terms toward consumers, since the user is a consumer in relation to Laandet)?
  - Is the unilateral change clause (§23, 30 days' notice) acceptable?

### L-12 DPIA and special categories
- **A:** A DPIA is not clearly mandatory (see `PRIVACY.md` §4). A short DPIA document is planned before the pilot.
- **Q:**
  - Confirm.
  - How to handle incidental health data in injury-related dispute statements.

### L-13 Marketing claims (green transition)
- **V (excerpt):** Stortinget adopted changes to markedsføringsloven in June 2026 (lovvedtak 85, 2025–26) implementing the EU "empowering consumers for the green transition" directive. The commencement date is not verified.
- **Q:** Are phrases like «Mer bruk. Mindre kjøp.», «gjenbruk» and «bærekraftig» acceptable without substantiation? They are generic claims on the site, not on products.

### L-14 Voluntary support (Spleis)
- **V (operator pages, secondary):**
  - Spleis fee for organisations and businesses is 6.5 % (4.5 % platform + 2 % transaction).
  - The recipient must verify with BankID and use a Norwegian bank account in their own name.
- **V (excerpt):** Innsamlingsregisterloven is **repealed**; there is no registration duty.
- **Q:**
  - Can an AS be the Spleis recipient?
  - Tax treatment of donations to a company.
  - Wording "gir ikke skattefradrag".
  - Any duty to account to donors.

### L-15 Prohibited and restricted items
- **A:** The lists in `PROHIBITED_ITEMS.md` cover the main legal and safety risks.
- **Q:**
  - Specific rules for lending trailers: does the renter's driving licence class need checking? Who is liable in a traffic incident? The owner's vehicle insurance and trailer registration?
  - E-scooter and e-bike rules.
  - Child car seats as giveaways.
  - Gas appliances.

## 3. Launch gate (legal)

The public pilot opens only when:
1. All documents in §1 marked "reviewed" by a qualified Norwegian lawyer (exception: Utvidet leieavtale, not used).
2. No `MÅ FYLLES UT FØR LANSERING` or `KONTROLLERES FØR LANSERING` markers remain in published texts.
3. Q-items L-01, L-03, L-04, L-05, L-06, L-07, L-08 and L-09 have written answers stored in `docs/legal-review/` (not committed if the lawyer requests confidentiality).
4. Every published legal text has `is_draft = false` in `legal_document_versions`.

**Recommended timing:** send the package to a lawyer in **week 44 (26.10–01.11.2026)**. Legal review is on the critical path to 14.12.2026 (see `DEVELOPMENT_ROADMAP.md`).
