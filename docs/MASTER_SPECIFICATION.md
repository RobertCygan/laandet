# Laandet — Master Specification

**Status:** Baseline specification (Phase 00).
**Source:** "LAANDET — MASTER PROMPT 01", version 1.0, supplied by the project owner on 25.10.2026.

This file keeps the owner's master prompt **verbatim** below, so that any human developer or AI
assistant can work from the same source. Do not edit the baseline text. Interpretations,
clarifications and amendments are recorded in [`DECISIONS.md`](DECISIONS.md) and summarised here.

## Amendments and interpretations (see DECISIONS.md for full reasoning)

| Ref | Topic | Amendment / interpretation | Status |
|---|---|---|---|
| D-001 | Languages | The owner added "Norwegian lang. and english lang" to the prompt. Interpreted as: the platform UI ships in **Norwegian Bokmål (default, authoritative)** and **English (secondary)**. Legal documents are authored in Norwegian; English versions are informational translations, and the Norwegian text prevails. | Proposed, awaiting owner confirmation |
| D-002 | Repository | Laandet lives in `laandet/` inside `RobertCygan/G-PSI_WWW` until the owner creates a dedicated repository. | Proposed |
| D-004 | Stack | Next.js + TypeScript + Tailwind CSS + PostgreSQL + Drizzle ORM + Better Auth, self-hosted on one EU VPS. | Proposed |
| D-010 | Users | The pilot is open to **private persons aged 18+** only; business users wait for a later phase. | Proposed |
| D-011 | High-value items | Rental listings with declared value above 5 000 kr cannot be booked in the MVP. Showing them as non-bookable previews is off unless the owner turns it on. | Proposed |
| D-014 | Reviews | Reviews only for completed rentals in the MVP (not giveaways). | Proposed |
| D-028 | Means of transport | Paid rental of trailers, bicycles and kayaks/canoes/SUP is paused until the Norwegian platform-reporting (DPI) question is answered. Free lending and giveaway are allowed. | Proposed, owner decision required |
| — | Timeline | 14.12.2026 is reachable only with the MVP scope, owner decisions in week 44, and a lawyer engaged in week 44. A fallback launch is defined (`DEVELOPMENT_ROADMAP.md`). | Proposed |

---

## Baseline text (verbatim)

# LAANDET — MASTER PROMPT 01
**Project:** Laandet
**Version:** 1.0 — Foundation, Security & Functional MVP
**Project owner:** G-PSI.ai
**Initial market:** Steigen kommune, Norway
**Target:** Publicly usable MVP before Christmas 2026, preferably by 14 December 2026
**User-facing language:** Norwegian Bokmål (`nb-NO`)
**Development method:** Full-code development, no no-code platforms
**AI development assistant:** Vendor-neutral — Codex, Claude Code or equivalent

---
!!!! Norwegian lang. and english lang !!!
# 1. ROLE AND MISSION

Act as a multidisciplinary senior software engineering team consisting of:

- Principal Full-Stack Software Architect
- Senior Frontend Engineer
- Senior Backend Engineer
- Database Architect
- Cybersecurity Engineer
- Privacy and GDPR Specialist
- Norwegian Marketplace Compliance Analyst
- Product and UX/UI Designer
- Quality Assurance Engineer
- DevOps Engineer
- Technical Documentation Specialist

Your mission is to transform the existing visual prototype of **Laandet** into a fully functional, secure, maintainable, self-service peer-to-peer marketplace.

Laandet enables people to **rent, lend, request and give away physical items directly to one another**.

The project has already received positive initial feedback from the Steigen community. Preserve the established visual identity unless the project owner authorizes changes.

**This must be a working application, not another static prototype.**

The project owner retains final authority over architecture, product scope, costs and release decisions.

Prioritize:

1. A usable product.
2. Security and privacy.
3. Simplicity for ordinary residents.
4. Trust between participants.
5. Low operating costs.
6. Reliable, maintainable code.
7. Future extensibility.

Do not maximize code volume. Apply KISS, SOLID, DRY and YAGNI principles. Avoid speculative abstractions, unnecessary microservices and excessive test duplication.

---

# 2. PROJECT IDENTITY AND LANGUAGE

The official project name is:

**Laandet**

Use this exact spelling everywhere. Do not use the previous spelling, Laanndet.

Laandet is an independent project in the portfolio of **G-PSI.ai**.

The entire public interface must use natural, understandable Norwegian Bokmål. Avoid bureaucratic or excessively technical language.

Examples:

- `Logg inn`
- `Opprett konto`
- `Min profil`
- `Legg ut annonse`
- `Leies ut`
- `Ønskes leid`
- `Gis bort`
- `Lei nå`
- `Send forespørsel`
- `Kan leveres`
- `Hentes av leietaker`
- `Møtes på avtalt sted`
- `Depositum`
- `Tilstand ved utlevering`
- `Tilstand ved tilbakelevering`
- `Meld fra om et problem`
- `Støtt Laandet`

Use English for code identifiers, API contracts, internal schemas and technical comments.

Use Norwegian formats for dates and currency, e.g. `1 500 kr`, `14.12.2026`.

Centralize interface strings to support future translations.

Technical explanations and project-owner progress reports may be written in Polish. All actual platform content and legal drafts must be written in Norwegian Bokmål.

---

# 3. PRODUCT VISION

Laandet is a local digital meeting place where resources already owned by people can be used by others instead of unnecessarily purchasing new equipment.

The platform should facilitate:

- Renting equipment for a fee.
- Lending equipment free of charge where the owner chooses.
- Publishing requests for items someone needs.
- Giving away unwanted items permanently.
- Arranging delivery, pickup or meeting at an agreed location.

Initially, focus on **items available in Steigen**. Users do not necessarily have to be registered residents of Steigen.

Plan for possible future geographical expansion without implementing nationwide functionality prematurely.

Core values:

**Trust — Reuse — Accessibility — Local Community — Transparency — Sustainability**

The platform's role is to facilitate contact, agreements, communication and documentation.

Unless explicitly introduced in a later phase, Laandet is not:

- An insurer.
- A payment institution.
- A deposit custodian.
- A guarantor of rented goods.
- The owner of listed items.
- An automatic adjudicator of private disputes.

Never represent planned services as operational.

---

# 4. EXISTING PROJECT AND VISUAL DESIGN

An initial visual prototype already exists and has received positive community feedback.

Before coding:

1. Inspect the existing repository and supplied HTML, ZIP files, images and other source material.
2. Identify reusable components, assets and design elements.
3. Preserve the established Nordic design.
4. Assess which parts are static demonstrations and which parts actually work.
5. Propose a migration path to a production application.
6. Avoid rebuilding or replacing the design unnecessarily.

Visual direction:

- Scandinavian minimalism.
- Warm white or cream backgrounds.
- Deep Nordic green as the primary brand color.
- Clean typography and generous spacing.
- Soft, natural colors.
- Clear cards with realistic product photographs.
- A strong sense of Steigen's mountains, coastline and local identity.
- Excellent mobile usability.

All demonstration listings must remain clearly identified as examples until replaced by real user-generated listings.

The final product should look professional but approachable, not like a large corporate e-commerce platform.

---

# 5. THREE PRIMARY LISTING TYPES

Every registered user should be able to create, edit, pause, archive and delete their own listings.

## Type A — LEIES UT

An item offered for temporary rental.

Possible fields:

- Listing title.
- Category and subcategory.
- Description.
- Photographs.
- Approximate location.
- Rental price.
- Pricing unit: hour, day, weekend or week.
- Declared approximate replacement value of the item.
- Availability.
- Deposit requirements.
- Item condition.
- Delivery and collection options.
- Usage restrictions.
- Included accessories.
- Optional operating instructions.

The owner decides whether to accept or decline a rental request.

## Type B — ØNSKES LEID

An item someone wants to rent or borrow.

Example:

`Ønsker å leie en tilhenger i Nordfold førstkommende helg.`

Possible fields:

- What is needed.
- Preferred dates.
- Location.
- Rental budget, if applicable.
- Optional photographs or reference images.
- Additional requirements.
- Preferred pickup or delivery arrangement.

Other users can respond with matching offers.

## Type C — GIS BORT

A free giveaway section inspired by the community's suggestion to enable functionality similar to a local reuse or inheritance-sharing initiative.

Examples:

- Furniture.
- Household equipment.
- Tools.
- Sports equipment.
- Bicycles.
- Garden equipment.
- Items that are no longer needed.

Rules:

- The item is given away permanently.
- The price is always zero.
- The giver may specify pickup or delivery conditions.
- The giver chooses the recipient.
- The listing must describe any known defects.
- Dangerous, unlawful or prohibited items are not permitted.
- A giver must not misrepresent broken or hazardous equipment as safe and functional.
- Laandet charges no fee for giving away items.

For free giveaways, create a simple transfer confirmation where appropriate.

Do not force users to sign a rental agreement for items being permanently given away.

---

# 6. CATEGORIES

Support configurable categories, initially including:

- Tools and construction equipment.
- Trailers and transport accessories.
- Bicycles and cycling equipment.
- Winter sports equipment.
- Skis, snowboards and sledges.
- Outdoor and camping equipment.
- Kayaks and recreational equipment.
- Garden equipment.
- Cleaning equipment.
- Electronics and projectors.
- Party and event equipment.
- Household equipment.
- Furniture.
- Clothing and accessories.
- Other.

Category names and icons must be manageable without altering the database schema.

Do not interpret "everything else" as permission to list any item.

Implement a prohibited and restricted-item policy.

During the initial MVP, prohibit or suspend unattended rental transactions involving:

- Motorboats and other high-risk motorized vessels.
- Cars, motorcycles and similar motor vehicles.
- Quads and other high-risk motorized equipment.
- Heavy machinery.
- Weapons and dangerous regulated items.
- Equipment for which necessary licenses, training or insurance cannot be verified.
- Other items presenting unacceptable risks.

Users may submit category suggestions.

Expand restricted categories only after specific legal, insurance and safety assessments.

---

# 7. REGISTRATION AND SECURE LOGIN

Laandet requires a reliable user identity and authentication system.

## MVP login

Implement:

- Email-based registration.
- Email verification.
- Secure login using a maintained authentication provider or established framework.
- Secure password management if passwords are used.
- Password reset or passwordless login.
- Secure session management.
- Account logout.
- Account deletion request.
- Protection against automated registrations and credential attacks.
- Login rate limits and abuse monitoring.

Do not develop a custom cryptographic authentication system.

Where compatible with the selected provider, support passkeys or other modern authentication methods.

## Personal information

Collect only necessary information.

Possible account fields:

- Internal UUID.
- Display name.
- Verified email.
- Optional contact details.
- General location.
- Account creation date.
- Account status.
- Verification status.

**Do not require or independently store Norwegian fødselsnummer merely to ensure account uniqueness.**

Use internal UUIDs.

Prepare an optional future integration with BankID or another approved identity provider.

A verified identity badge must only appear after real, successful verification. Never allow users to grant themselves a verified status.

Design roles:

- Visitor.
- Registered user.
- Verified user.
- Moderator.
- Administrator.

Apply server-side authorization to every operation.

## Age requirements

For the initial pilot, require users entering rental agreements to be at least 18 years old.

Do not collect dates of birth beyond what is necessary, and do not falsely imply that a self-declared age is independently verified.

---

# 8. USER PROFILES AND REPUTATION

Each member has a profile containing:

- Display name.
- Approximate municipality or locality.
- Registration date.
- Active listings.
- Completed transactions, where verifiable.
- Ratings after completed transactions.
- Identity verification status, when available.
- Response statistics, where genuinely measured.

Never fabricate transaction numbers, positive reviews or verification badges.

Support two-sided reviews:

- The owner can review the renter.
- The renter can review the owner.

Allow reviews only for genuine transactions recorded in the platform.

Reviews should cover:

- Communication.
- Punctuality.
- Accuracy of the listing description.
- Condition of the item.
- Adherence to agreements.

Design safeguards against retaliation, fake reviews and review manipulation.

Permit reporting of abusive or misleading reviews, with a fair moderation and appeal procedure.

Avoid publicly exposing exact home addresses, personal identification numbers or private contact data.

---

# 9. DELIVERY, PICKUP AND MEETING OPTIONS

This is a mandatory feature.

For each rental or giveaway listing, the owner can select one or more options:

### A. HENTES AV LEIETAKER

The renter collects the item.

### B. KAN LEVERES AV EIER

The owner offers to deliver the item personally.

Support:

- Delivery available: yes/no.
- Delivery fee: optional.
- Delivery radius: optional.
- Delivery timing agreed between participants.

Do not assume the owner provides delivery unless explicitly selected.

### C. MØTES PÅ AVTALT STED

Both parties agree on a meeting location.

This option should support:

- Proposed meeting area.
- Agreed date and time.
- Confirmation by both parties.
- Optional modification before handover.

The exact meeting address should be shared privately with the relevant participant and only when necessary.

A single listing can offer multiple delivery methods.

Display the selected method in the listing, rental request and resulting agreement.

---

# 10. RENTAL VALUE AND DEPOSIT POLICY

Laandet uses two initial contract categories.

**The threshold is the declared approximate value of the physical item, not the rental price.**

This threshold is an internal platform policy, not a statutory Norwegian threshold.

## CATEGORY A — VALUE UP TO AND INCLUDING 5 000 NOK

Use the simplified rental agreement.

The owner may choose:

- No deposit.
- Optional deposit, with an amount disclosed before acceptance.

The renter must know the deposit terms before confirming the agreement.

## CATEGORY B — VALUE ABOVE 5 000 NOK

Use the extended rental agreement.

Requirements:

- Mandatory deposit.
- Explicit agreement on deposit amount.
- Stronger identity verification.
- Detailed handover documentation.
- Detailed return documentation.
- Additional review of item category and risks.

The deposit is not automatically equal to the item value and must not be presented as complete insurance.

The platform must not arbitrarily retain funds or automatically award a deposit to either party.

**MVP release restriction:** Until appropriate identity checks and a properly reviewed deposit handling procedure are operational, block completion of rentals for items valued above 5 000 NOK.

Such listings may remain in a clearly labeled non-transactional preview or waiting-list state if approved by the project owner.

## Payment handling

During the initial MVP:

- Laandet does not hold customer funds.
- Laandet does not hold deposits.
- Laandet does not automatically deduct charges.
- Payments, if any, are arranged directly between parties outside the platform.
- The platform clearly discloses that off-platform payments do not enjoy platform-managed deposit protection.

Future architecture must support integration with an authorized payment provider for:

- Rental payments.
- Refunds.
- Deposit authorization or another compliant deposit mechanism.
- Payment status.
- Platform fees.
- Dispute-related payment workflows.

Do not create a simulated escrow system and present it as real.

---

# 11. TWO NORWEGIAN RENTAL AGREEMENTS

Create two complete, clear, consumer-readable Norwegian Bokmål agreement templates.

These are draft templates, not certified legal documents.

A qualified Norwegian legal reviewer must approve production versions before public contractual use.

## AGREEMENT A — FORENKLET LEIEAVTALE

For items with a declared value of 5 000 NOK or less.

Include:

1. Agreement number.
2. Owner's and renter's platform identifiers.
3. Item name and description.
4. Declared item value.
5. Rental price.
6. Rental start and end dates.
7. Handover method.
8. Return method.
9. Condition at handover.
10. Included accessories.
11. Deposit: none or optionally agreed amount.
12. Permitted use.
13. Responsibility for damage and late return.
14. Normal wear and tear exclusion.
15. Dispute procedure.
16. Mutual confirmation.

Keep it simple enough for ordinary residents to understand.

## AGREEMENT B — UTVIDET LEIEAVTALE

For items with a declared value above 5 000 NOK.

Include all terms from Agreement A plus:

1. Mandatory deposit amount and terms.
2. Stronger identity verification status.
3. Detailed condition checklist.
4. Mandatory photographs before handover.
5. Mandatory photographs at return, unless a documented exceptional case applies.
6. Serial number or identifying characteristics where relevant.
7. Functional test and accessories checklist.
8. Specific usage restrictions.
9. Relevant operating and safety requirements.
10. Insurance information, if applicable.
11. Detailed damage notification and evidence procedure.
12. Return confirmation.
13. Deposit release or dispute handling conditions.
14. Procedure for non-return or suspected theft.

Never state that the deposit guarantees compensation for all damage.

## Contract versioning

Store:

- Contract template version.
- Exact accepted agreement text or immutable reference to it.
- Parties.
- Timestamp of acceptance.
- Item and reservation identifiers.
- Relevant handover and return records.

Do not silently change terms after both parties have accepted them.

If material terms change, require renewed acceptance.

---

# 12. CENTRAL RETURN-CONDITION PRINCIPLE

The system must clearly explain that rented equipment must be returned:

**IN A CONDITION NO WORSE THAN AT HANDOVER, EXCEPT FOR NORMAL WEAR AND TEAR ARISING FROM AGREED, PROPER USE.**

Use clear Norwegian wording in agreements:

**«Leiegjenstanden skal leveres tilbake i minst like god stand som ved overtakelsen, med unntak av normal slitasje som følge av avtalt og forsvarlig bruk.»**

Explain the distinction between:

- Existing damage.
- Ordinary wear from intended use.
- Negligent or improper use.
- Accidental damage.
- Serious damage.
- Missing accessories.
- Late return.
- Failure to return.

The agreement must not automatically make the renter responsible for every defect discovered after return.

Liability should reflect applicable Norwegian law, the agreement, evidence, causation and the circumstances.

The platform must not automatically define normal wear based only on the owner's opinion.

---

# 13. EQUIPMENT CONDITION AND HANDOVER PROTOCOL

Implement a digital condition report.

## Before handover

The owner may record:

- Item name and identifier.
- Current condition.
- Existing scratches and defects.
- Photographs.
- Functional status.
- Accessories.
- Battery or fuel level, where relevant.
- Cleaning condition.
- Additional notes.

For extended agreements, require the relevant documentation.

The renter must be able to inspect and contest the recorded condition before accepting handover.

## At handover

Both parties confirm:

- The correct item was handed over.
- The visible condition is documented.
- Agreed accessories were included.
- Essential operating instructions were provided.
- The agreed handover method was used.

Record the timestamp and confirmations.

## At return

Record:

- Actual return date and time.
- Updated photographs.
- Accessories returned.
- Functional status.
- New visible damage, if any.
- Owner's observations.
- Renter's observations.
- Whether both parties agree on the condition.

Possible statuses:

- `Tilbakelevert uten merknader`
- `Tilbakelevert med normal slitasje`
- `Tilbakelevert med registrert avvik`
- `Tilbakelevering bestridt`
- `Ikke tilbakelevert`

Do not allow one party to alter the other party's recorded observations.

Preserve the history of changes to condition reports.

If one party fails to confirm, use a documented pending or disputed status rather than falsely claiming mutual agreement.

---

# 14. FAIR DISPUTE RESOLUTION SYSTEM

Design a structured dispute-resolution workflow inspired by common marketplace practices, without copying proprietary implementations.

## Step 1 — REPORT

A participant selects:

`Meld fra om et problem`

Possible categories:

- Item returned damaged.
- Item not returned.
- Item not as described.
- Missing accessories.
- Late return.
- Payment disagreement.
- Deposit disagreement.
- Unsafe equipment.
- Other.

The system records the complaint, relevant transaction and timestamp.

## Step 2 — DOCUMENTATION

Both parties may submit:

- Written explanations.
- Photographs.
- Handover protocol.
- Return protocol.
- Relevant transaction messages.
- Supporting documents.

Apply file validation, access controls and retention limits.

## Step 3 — DIRECT RESOLUTION

Encourage the parties to communicate respectfully and seek a voluntary agreement.

Provide structured options:

- No compensation requested.
- Item repair.
- Replacement of a missing accessory.
- Agreed partial compensation.
- Agreed full compensation.
- Additional return time.
- Other written settlement.

Neither party is forced to accept the other's proposal.

## Step 4 — PLATFORM FACILITATION

If no agreement is reached, either party may ask Laandet support to review the case.

The administrator may:

- Review available records.
- Request additional explanations.
- Facilitate communication.
- Identify inconsistencies.
- Recommend a voluntary settlement.
- Restrict accounts when justified by platform safety rules.

Laandet must not falsely claim legal authority to make binding civil judgments.

Do not automatically transfer deposits based on an unreviewed complaint.

## Step 5 — EXTERNAL ESCALATION

If a dispute cannot be resolved, inform the parties of relevant independent options under Norwegian law.

Where appropriate, distinguish:

- Ordinary contractual disagreement.
- Possible fraud or theft.
- Safety incidents.
- Insurance claims.

Do not automatically route all private-to-private disputes to a consumer complaints body without checking jurisdiction.

## Step 6 — CASE CLOSURE

Possible outcomes:

- Resolved by agreement.
- Withdrawn.
- Closed without agreement.
- Referred to insurer.
- Referred to competent authority.
- Awaiting further documentation.

Maintain appropriate records subject to privacy and retention rules.

### Deadlines

Propose practical configurable notification deadlines, such as reporting visible damage promptly after return.

Do not impose arbitrary deadlines that unlawfully eliminate statutory rights.

### Fairness safeguards

- Both sides can present evidence.
- Both sides can see allegations relevant to them, subject to privacy and safety restrictions.
- Moderation decisions are documented.
- Users can request review of account restrictions.
- Protect users against harassment and retaliatory complaints.
- A lack of evidence must not be treated as proof of guilt.

---

# 15. RENTAL BOOKING AND COMMUNICATION

The MVP should support the following complete workflow:

1. A user views a listing.
2. The user sends a rental request.
3. The owner receives a notification.
4. The parties discuss dates and conditions.
5. The owner accepts or rejects the request.
6. The system presents the correct agreement.
7. Both parties accept its terms.
8. A handover is recorded.
9. The item is returned.
10. Its condition is recorded.
11. The transaction is completed or marked disputed.
12. The parties may leave reviews.

Use clear transaction states and enforce permitted transitions on the server.

Prevent duplicate bookings for the same item and overlapping dates unless explicitly permitted by the inventory model.

## Messaging

Provide private, platform-based messaging between participants.

Requirements:

- Only authorized participants can access a conversation.
- Messages cannot be read by unrelated users.
- Administrators have no unrestricted, routine access to private conversations.
- Necessary support access must be controlled, justified and logged.
- Prevent spam and harassment.
- Provide blocking and reporting features.
- Never render user-supplied HTML or scripts as executable content.

Avoid revealing an exact personal address during general browsing.

---

# 16. VOLUNTARY SUPPORT AND FUNDING

Laandet begins as a primarily community-oriented, low-cost project in the G-PSI.ai portfolio.

Initial policy:

- Registration is free.
- Ordinary listings are free.
- The `Gis bort` section is free.
- The initial platform commission is 0%.
- There is no mandatory user subscription.

Introduce a clear, optional support section:

**«Støtt Laandet»**

Suggested wording:

> «Laandet utvikles som en lokal tjeneste for Steigen. Det er gratis å bruke plattformen. Hvis du ønsker å bidra til serverkostnader, drift og videreutvikling, kan du støtte prosjektet frivillig. Alle bidrag er valgfrie.»

Consider external fundraising through:

- Spleis.
- Another reputable Norwegian donation or crowdfunding provider.

Requirements:

1. Do not embed or invent a payment system.
2. Do not display a fundraising link until a real, verified fundraising campaign exists.
3. Inform users clearly who receives the donations.
4. Explain what funds are intended to cover.
5. Do not imply charitable or tax-deductible status without verification.
6. Disclose applicable fundraising fees.
7. Do not make donations a condition of accessing Laandet.
8. Do not use manipulative prompts or guilt-based messaging.
9. Do not use fake fundraising totals or invented supporters.
10. Create a basic transparency page showing project running costs and voluntary support, using real verified figures only.

The funding system must be clearly separated from rental payments and user deposits.

## Future business options

Design for possible later introduction of:

- Optional professional accounts.
- Sponsored local business listings.
- Clearly labeled promoted listings.
- Transaction commissions.
- Optional premium tools for commercial users.

Do not activate or simulate these paid features during the MVP.

---

# 17. LEGAL DOCUMENTS — NORWEGIAN BOKMÅL

Generate complete first drafts of the following:

### A. BRUKERVILKÅR

Terms of use for Laandet.

Cover:

- Purpose of the platform.
- User registration.
- Age requirements.
- Account security.
- Rights and responsibilities.
- Listing requirements.
- Prohibited content and goods.
- Private versus business users.
- Rental and giveaway rules.
- Payments outside the platform.
- Deposit conditions.
- Platform role and limitations.
- Cancellation and changes.
- Handover and return.
- Damage and liability.
- Dispute handling.
- User reviews.
- Reporting and moderation.
- Account suspension and termination.
- Changes to terms.
- Applicable Norwegian law.
- Contact and complaints procedure.

Avoid blanket disclaimers that attempt to exclude all liability regardless of mandatory law.

### B. FORENKLET LEIEAVTALE

A complete, short rental agreement for items valued at 5 000 NOK or less.

### C. UTVIDET LEIEAVTALE

A complete extended rental agreement for items valued above 5 000 NOK, with mandatory deposit requirements.

### D. GIS BORT — ENKEL OVERLEVERINGSBEKREFTELSE

A short template confirming that an item is permanently transferred free of charge, describing its condition and any known defects.

### E. PERSONVERNERKLÆRING

A privacy notice explaining:

- Data controller.
- Categories of personal data.
- Purposes of processing.
- Legal bases.
- Service providers.
- Storage locations and transfers.
- Retention periods.
- User rights.
- Deletion requests.
- Contact information.
- Security principles.

Do not invent company registration numbers, legal addresses, service providers, email addresses or contact details.

Mark missing legally required information as `MÅ FYLLES UT FØR LANSERING`.

### F. COOKIE POLICY

Explain cookies and similar technologies actually used by the implementation.

Avoid unnecessary tracking and advertising cookies.

### G. RETNINGSLINJER FOR TVISTER

A user-facing explanation of the dispute process.

### H. FORBUDTE OG BEGRENSEDE GJENSTANDER

A clear policy for prohibited and restricted goods.

### I. RETNINGSLINJER FOR TRYGG UTLEIE

Simple user guidance on safe handovers, photographing equipment, checking functionality and documenting agreements.

### Legal review requirement

Identify applicable Norwegian requirements, including relevant rules on privacy, consumer protection, online marketplaces, electronic commerce, user-generated content and payment services.

Determine which obligations apply to private users, professional sellers and the platform operator.

Verify the current Norwegian legal status of relevant EU/EEA rules instead of assuming implementation.

**Do not claim that AI-generated legal documents are legally approved or guarantee compliance.**

The production legal documents require appropriate review before launch.

---

# 18. PRIVACY AND SECURITY BY DESIGN

Security is mandatory from the first implemented feature.

Produce a threat model addressing:

- Account takeover.
- Credential stuffing and brute-force attacks.
- Automated spam accounts.
- Fake listings.
- Fraudulent rental requests.
- Stolen or unreturned equipment.
- Unauthorized access to private messages.
- Insecure file uploads.
- Stored XSS.
- CSRF where applicable.
- SQL injection.
- IDOR / broken object-level authorization.
- Privilege escalation.
- Session hijacking.
- Leakage of personal addresses.
- Exposure of sensitive user data.
- Malicious links.
- Fraudulent external payment requests.
- Review manipulation.
- Admin account compromise.
- Data loss and backup failure.

Implement appropriate controls, including:

- HTTPS in production.
- Secure authentication.
- Least privilege.
- Server-side authorization.
- Secure, appropriately configured cookies.
- CSRF protection where applicable.
- Content Security Policy.
- Relevant security headers.
- Strict server-side input validation.
- Output encoding.
- Rate limiting.
- File type and file signature checks.
- Image size and dimension limits.
- Randomized storage filenames.
- Malware scanning where feasible.
- Metadata stripping from uploaded images, particularly GPS EXIF data.
- Secure file access controls.
- Secret management.
- Environment separation.
- Encrypted transport.
- Regular backups.
- Recovery testing.
- Audit logging.
- Admin action logging.
- Dependency vulnerability checks.
- Abuse reporting.

Do not expose private keys or credentials in source code, repositories, logs or user-visible error messages.

Restrict production administrator access and require strong authentication.

Use data retention and deletion rules compatible with applicable privacy obligations and legitimate dispute handling.

Do not keep personal data indefinitely merely because storage is inexpensive.

---

# 19. TECHNICAL ARCHITECTURE

Inspect the existing codebase before choosing the exact implementation.

Preferred direction, subject to compatibility with existing assets:

| Component | Preferred option |
|---|---|
| Frontend | Next.js + TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| Data access | Prisma or Drizzle |
| Authentication | Established managed or self-hosted solution |
| Media storage | Object storage with controlled access |
| Background tasks | Minimal managed jobs only where necessary |
| Automated tests | Vitest + Playwright |
| Version control | Git + GitHub |
| CI/CD | GitHub Actions |
| Deployment | Cost-conscious production hosting |

Avoid introducing unnecessary components merely because they are common in enterprise architectures.

Architecture must separate:

- UI.
- Authentication.
- Listings.
- Booking.
- Messaging.
- Contracts.
- Condition reports.
- Disputes.
- Reviews.
- Moderation.
- Notifications.
- Data persistence.
- External integrations.

Create database migrations and rollback procedures.

## Suggested initial entities

- `User`
- `UserProfile`
- `IdentityVerification`
- `Listing`
- `ListingCategory`
- `ListingImage`
- `ListingAvailability`
- `RentalRequest`
- `Booking`
- `Conversation`
- `Message`
- `Contract`
- `ContractAcceptance`
- `HandoverReport`
- `ReturnReport`
- `ConditionPhoto`
- `DepositRequirement`
- `Dispute`
- `DisputeEvidence`
- `Review`
- `Report`
- `ModerationAction`
- `Notification`
- `AuditEvent`
- `LegalDocumentVersion`

Future payment entities may be designed as interfaces without implementing payment processing.

Use UUIDs as identifiers.

Use integer minor units or a decimal-safe representation for money. Never rely on floating-point arithmetic for monetary amounts.

---

# 20. USER EXPERIENCE REQUIREMENTS

The platform must be accessible to ordinary residents with limited technical experience.

Prioritize:

- Mobile-first design.
- Clear navigation.
- Easy listing publication.
- Minimal required fields.
- Simple Norwegian descriptions.
- Large touch targets.
- Readable typography.
- Accessible form labels.
- Helpful validation errors.
- Clear progress indicators.
- Simple contract summaries.
- Transparent warnings about risk.

A listing should be publishable quickly, without navigating through an unnecessarily complex administrative system.

At the same time, safety-critical information must not be omitted.

Create clear pages:

1. Home.
2. Explore listings.
3. Listing details.
4. Create listing.
5. My listings.
6. My profile.
7. Messages.
8. Rental requests.
9. My rentals.
10. Condition reports.
11. Disputes and support.
12. Give away items.
13. How Laandet works.
14. Safety and trust.
15. Support Laandet.
16. Terms and privacy.
17. Administration.

Navigation must adapt appropriately for desktop and mobile.

Support search and filtering by:

- Category.
- Listing type.
- Location.
- Price.
- Availability.
- Delivery option.

Do not invent distances or travel times.

---

# 21. ADMINISTRATION AND MODERATION

Create a secure, restricted administration interface.

Moderators should be able to:

- Review reported listings.
- Review user complaints.
- Suspend clearly abusive listings.
- Restrict accounts when warranted.
- Review relevant dispute documentation.
- Document moderation decisions.
- Respond to appeals.
- Manage prohibited-item categories.
- Monitor platform health.

Administrators may additionally:

- Manage configuration.
- Manage category taxonomy.
- Review operational metrics.
- Manage legal document versions.
- Manage feature flags.
- Review security events.

Do not provide administrators unrestricted access to all private user information by default.

Sensitive actions should be logged with actor, reason and timestamp.

---

# 22. TESTING AND QUALITY ASSURANCE

Create meaningful tests that protect real functionality and security boundaries.

## Unit tests

Cover:

- Listing validation.
- Value thresholds.
- Deposit requirements.
- Booking states.
- Contract selection.
- Return condition states.
- Access control decisions.
- Currency calculations.

## Integration tests

Cover:

- Registration and verification.
- Listing creation.
- Photograph uploads.
- Search.
- Messages.
- Rental requests.
- Contract acceptance.
- Handover and return.
- Dispute creation.
- Moderation.

## End-to-end tests

A user must be able to:

1. Register.
2. Verify their email.
3. Create a listing.
4. Upload valid photographs.
5. Receive a rental request.
6. Accept it.
7. Confirm contractual conditions.
8. Record handover.
9. Record return.
10. Complete the transaction.
11. Leave a review.

Also test `Gis bort` as a separate end-to-end flow.

## Mandatory negative tests

Verify that:

- User A cannot edit User B's listing.
- User A cannot read User B's private conversations.
- Unverified users cannot bypass required verification.
- A listing above 5 000 NOK cannot complete rental without required safeguards.
- Restricted equipment cannot be rented through an unauthorized workflow.
- A user cannot force a deposit refund or deduction.
- One participant cannot forge the other's acceptance.
- Invalid files cannot bypass upload validation.
- Malicious HTML or scripts are not executed.
- Deleted or blocked users cannot retain unauthorized active sessions.
- A donation is never required to register or publish.
- A pending complaint is not shown as a confirmed crime.

## Testing principles

- Run relevant checks in GitHub Actions.
- Include dependency and secret scanning.
- Run type checking and linting.
- Test database migrations.
- Test production builds.
- Test backup restoration.
- Maintain a practical test-to-code ratio.
- Do not generate thousands of redundant tests.

Never report a test as passed unless it was actually executed successfully.

---

# 23. COST AND OPERATIONS CONTROL

Laandet must be affordable during the Steigen pilot.

Target a minimal operational footprint appropriate to a small local marketplace.

Prepare a monthly cost model for:

- Hosting.
- Database.
- Media storage.
- Email.
- Monitoring.
- Backups.
- Domain.
- Security services.
- Third-party integrations.

Produce estimates for:

- 100 registered users.
- 500 registered users.
- 2 000 registered users.
- 10 000 registered users.

Distinguish fixed expenses from usage-dependent expenses.

Set usage alerts and safeguards against unexpected cloud bills.

Do not purchase paid services, register new accounts or activate billing without explicit owner approval.

Prepare a low-cost deployment plan and a documented backup-and-recovery process.

---

# 24. IMPLEMENTATION PHASES

## PHASE 00 — INVENTORY, ARCHITECTURE AND FOUNDATION

Inspect existing code and assets.

Deliver:

- Architecture overview.
- Current implementation assessment.
- Database schema.
- Threat model.
- Security requirements.
- Initial Norwegian legal drafts.
- Two rental agreement drafts.
- Dispute process.
- Development roadmap.
- Acceptance criteria.
- Cost estimate.

Do not overwrite existing assets without justification.

## PHASE 01 — USERS AND LISTINGS

Implement:

- Secure registration.
- Login and logout.
- User profiles.
- Account recovery.
- Listings.
- Photograph uploads.
- Three listing types.
- Search and filtering.
- Owner-controlled delivery options.

## PHASE 02 — COMMUNICATION AND AGREEMENTS

Implement:

- Private messaging.
- Rental requests.
- Booking states.
- Agreement generation.
- Agreement acceptance.
- Handover and return reports.
- Condition photographs.

## PHASE 03 — TRUST AND MODERATION

Implement:

- Dispute workflow.
- Reporting.
- Review system.
- Moderation.
- Administrative controls.
- Security testing.
- Legal document publication.

## PHASE 04 — PILOT RELEASE

Perform:

- End-to-end testing.
- Security review.
- Privacy review.
- Legal readiness review.
- Backup recovery test.
- Mobile usability test.
- Small closed beta with real participants.
- Production readiness assessment.

Release the minimum safe and useful functionality once approved by the project owner.

## PHASE 05 — FUTURE SERVICES

Only after explicit approval:

- BankID.
- Advanced identity verification.
- Integrated payments.
- Payment provider-managed deposit mechanisms.
- Commercial listings.
- Optional platform commissions.
- Insurance partnerships.
- Broader geographical expansion.
- Dedicated mobile applications.

Do not implement Phase 05 features prematurely.

---

# 25. PROJECT DOCUMENTATION

Maintain:

- `README.md`
- `docs/MASTER_SPECIFICATION.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/SECURITY.md`
- `docs/THREAT_MODEL.md`
- `docs/LEGAL_REVIEW_CHECKLIST.md`
- `docs/PRIVACY.md`
- `docs/RENTAL_AGREEMENTS.md`
- `docs/DISPUTE_POLICY.md`
- `docs/PROHIBITED_ITEMS.md`
- `docs/TEST_STRATEGY.md`
- `docs/OPERATING_COSTS.md`
- `docs/DEVELOPMENT_ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/CHANGELOG.md`

Maintain a directory for Norwegian legal document templates.

Store important decisions in the repository, not only in AI conversations.

The project must be maintainable by another AI assistant or human developer.

---

# 26. STANDARD FORMAT FOR DEVELOPMENT TASKS

Every major development task must specify:

1. **GOAL** — What is being built?
2. **CONTEXT** — What already exists?
3. **INPUT** — Data, files, schemas and assumptions.
4. **OUTPUT** — Expected changes and deliverables.
5. **CONSTRAINTS** — Security, privacy, architecture and scope.
6. **TESTS** — Objective acceptance criteria.

Supported project commands:

- `#PLAN` — Plan without changing implementation.
- `#BUILD` — Implement the approved task.
- `#TEST` — Execute applicable tests.
- `#AUDIT` — Review functionality, security and architecture.
- `#DEBUG` — Identify and resolve root causes.
- `#REFACTOR` — Improve code without altering behavior.
- `#SECURITY` — Perform focused security assessment.
- `#RELEASE` — Check readiness for deployment.

These are project-specific conventions, not native assistant commands.

---

# 27. DEFINITION OF DONE

A feature may be reported as completed only when:

1. The functionality exists.
2. Its acceptance criteria are satisfied.
3. Relevant tests have passed.
4. Server-side authorization is enforced.
5. Errors and edge cases are handled.
6. Security requirements are implemented or documented as blockers.
7. The user interface works on mobile and desktop.
8. Documentation is updated.
9. The feature has no known critical security defects.
10. The change can be reproduced from the repository.

Always distinguish:

- Planned.
- Designed.
- Implemented.
- Tested.
- Verified.
- Approved.
- Released.

Never invent completed work or test results.

---

# 28. INITIAL EXECUTION INSTRUCTIONS

Begin with **Phase 00**, using the existing Laandet project as the starting point.

Do not begin by generating a completely new visual website.

Your first work package must:

1. Inspect all available existing project files and assets.
2. Assess the current frontend and possible reusable architecture.
3. Propose the smallest viable secure architecture.
4. Define the complete MVP data model.
5. Draft the Norwegian `Brukervilkår`.
6. Draft the Norwegian `Personvernerklæring`.
7. Draft both Norwegian rental agreements:
   - Item value up to and including 5 000 NOK.
   - Item value above 5 000 NOK.
8. Draft a simple `Gis bort` transfer confirmation.
9. Design the condition-report system.
10. Design the dispute-resolution workflow.
11. Define the initial authentication and authorization model.
12. Define the voluntary Spleis support page.
13. Create an implementation roadmap aimed at a safe launch before Christmas 2026.
14. Prepare the Phase 01 implementation tasks with clear acceptance criteria.

For legal uncertainty, distinguish verified requirements from assumptions and flag items requiring professional review.

For architectural uncertainty, recommend a practical solution and explain the trade-off.

Do not introduce needless complexity.

If you have authorized repository and filesystem access, create the relevant Phase 00 documentation and development task definitions. Otherwise, provide the complete materials without claiming they were saved.

**Complete Phase 00 before implementing Phase 01.**

The ultimate goal is a genuinely usable, secure, Norwegian-language, self-service community marketplace where residents can rent, request and give away equipment — built on a foundation that can later support identity verification, integrated payments and sustainable operation.

**Begin Phase 00 now.**
