# Laandet — Category Taxonomy and Prohibited / Restricted Items Policy (technical)

**Status:** Designed (Phase 00). Owner approval needed, especially for D-028 (paid rental of means of transport).
**User-facing policy (authoritative nb):** [`../legal/nb/forbudte-og-begrensede-gjenstander.md`](../legal/nb/forbudte-og-begrensede-gjenstander.md)

## 1. Policy tiers

| Tier | Meaning in the product |
|---|---|
| `allowed` | Can be listed for rent, wanted or give-away. |
| `restricted` | The category's safety notice is shown on the listing, in the request and in the agreement. **When publishing**, the owner must tick that they have read it (`listings.restricted_ack_at`). **When requesting**, the renter must tick «Jeg har nødvendig erfaring, utstyr og eventuelt førerrett for å bruke dette trygt». New restricted listings appear in a moderator queue (post-moderation). |
| `prohibited` | Cannot be selected. Wanted and give-away listings for such items are also not allowed. |
| `allow_paid_rental = false` | Only free lending (price 0) and give-away are possible. This applies to categories that may fall under the Norwegian platform-reporting rules (DPI) for "rental of means of transport" until legal review clarifies it (D-028, `LEGAL_REVIEW_CHECKLIST.md` L-07). |

Categories are rows in the `categories` table. Names (nb/en), icon, tier, safety notice and
`allow_paid_rental` are editable by admins (audited) without schema changes. The list below is
the **initial seed**.

## 2. Initial categories (seed)

The list merges the master specification categories and the prototype's 19 categories.

| Slug | nb | en | Tier | Paid rental | Safety notice (summary) |
|---|---|---|---|---|---|
| `verktoy` | Verktøy | Tools | allowed | ✅ | — |
| `bygg` | Bygg og oppussing | Building and renovation | allowed | ✅ | — |
| `stiger-stillas` | Stiger og stillas | Ladders and scaffolding | restricted | ✅ | Fall risk; stable ground, assembly instructions, max height |
| `hage` | Hage | Garden | allowed | ✅ | — |
| `motoriserte-redskaper` | Motorsag, ryddesag, snøfreser og lignende | Chainsaws, brush cutters, snow blowers and similar | restricted | ✅ | Experience and protective equipment (chainsaw trousers, helmet, gloves, eye/hearing protection); never lend to persons under 18 |
| `rengjoring` | Rengjøring | Cleaning | allowed | ✅ | — |
| `tilhengere` | Tilhengere | Trailers | restricted | ⛔ *(D-028)* | Correct driving licence class (B / BE), car's towing capacity, valid EU inspection where required, lights tested |
| `transporttilbehor` | Takbokser og transporttilbehør | Roof boxes and transport accessories | allowed | ✅ | — |
| `sykler` | Sykler og sykkelutstyr | Bicycles and cycling equipment | allowed | ⛔ *(D-028)* | Helmet recommended; brakes checked |
| `vinter` | Ski, snowboard og akebrett | Skis, snowboards and sledges | allowed | ✅ | Bindings must be adjusted by someone competent |
| `friluft` | Friluftsliv og camping | Outdoor and camping | allowed | ✅ | — |
| `padling` | Kajakk, kano og SUP | Kayaks, canoes and SUP | restricted | ⛔ *(D-028)* | Life jacket for every person, weather and water temperature, experience, never paddle alone in cold water |
| `sport` | Sport og fritid | Sport and leisure | allowed | ✅ | — |
| `elektronikk` | Elektronikk og projektorer | Electronics and projectors | allowed | ✅ | — |
| `foto-video` | Foto og video | Photo and video | allowed | ✅ | Drones are not allowed (see §3) |
| `fest` | Fest og arrangement | Party and events | allowed | ✅ | — |
| `grill-gass` | Grill og gassutstyr | Grills and gas equipment | restricted | ✅ | Check hose and regulator, leak test, outdoor use only, gas bottles transported upright |
| `husholdning` | Husholdning og kjøkken | Household and kitchen | allowed | ✅ | — |
| `mobler` | Møbler | Furniture | allowed | ✅ | — |
| `klaer` | Klær og tilbehør | Clothing and accessories | allowed | ✅ | — |
| `barn` | Barn og familie | Children and family | allowed | ✅ | — |
| `barn-bilseter` (child of `barn`) | Bilseter for barn | Child car seats | restricted | ✅ | Must state whether it has been in a collision, and production date / expiry; never give away a seat that has been in a collision |
| `annet` | Annet | Other | allowed | ✅ | "Annet" does not mean "anything goes". The prohibited list applies. |

Prototype mapping:
- "Bil og transport" → `transporttilbehor` (no motor vehicles)
- "Båt og sjø" → `padling` (non-motorised only)
- "Camping" → `friluft`
- "Grill og matlaging" → `grill-gass` / `husholdning`
- "Hjem og kjøkken" → `husholdning`

## 3. Prohibited in the MVP (not selectable, also not as wanted or give-away)

| Group | Examples | Reason |
|---|---|---|
| Motor vehicles | cars, motorcycles, mopeds, ATV/quads, snowmobiles (snøscooter), golf carts | licence, registration, mandatory insurance; master spec §6 |
| Motorised vessels | motorboats, jet skis, outboard motors | licence/age rules, insurance, high risk; master spec §6 |
| Heavy machinery | excavators incl. mini-excavators, wheel loaders, lifts, cranes | training requirements, high risk |
| Drones | all drones | registration and competence requirements cannot be verified |
| Weapons | firearms and parts, ammunition, air guns, bows/crossbows, knives designed as weapons, pepper spray | law, safety |
| Explosives and fireworks | fireworks, black powder, detonators | law, safety |
| Hazardous substances | pesticides requiring authorisation, strong chemicals, asbestos-containing materials, fuel in loose containers | law, safety |
| Medicines, drugs, alcohol, tobacco, snus | — | law |
| Food and drink | — | food safety; out of scope for the MVP |
| Live animals | — | animal welfare and regulations |
| Unsafe or recalled products | items with a safety recall, damaged electrical insulation, defective safety equipment | safety |
| Items you have no right to lend or give | stolen goods, rented or leased goods, employer's property, counterfeits | law |
| Not physical items | services, jobs, housing, cabins, rooms, boat berths, parking spaces | out of scope; housing rental is also clearly reportable under DPI |
| Personal documents and data | ID cards, passports, licence plates, data media containing other people's data | law, privacy |
| Adult or offensive content | — | platform rules |

## 4. Enforcement

1. **Category picker:** `prohibited` categories are hidden. `restricted` categories show the notice before selection.
2. **Keyword screening:** a small, admin-editable keyword list (e.g. `snøscooter`, `båtmotor`, `gevær`, `fyrverkeri`, `minigraver`, `drone`, `ATV`) runs on the title and description. A match shows the user: «Det ser ut som annonsen kan gjelde en gjenstand som ikke er tillatt på Laandet. Les reglene.» If the user still publishes, the listing is **published but an automatic report** (`reports`, `reason = prohibited_item`, reporter = system) is queued for moderators. Keyword screening is a hint, not proof, so no automatic removal.
3. **Server validation:** the service rejects category `prohibited`; `restricted` without `restricted_ack_at`; price > 0 where `allow_paid_rental = false`; and requests for restricted listings without the renter confirmation.
4. **Reports:** every listing has «Rapporter annonse». Moderators can hide a listing with a statement of reasons. The owner can appeal.
5. **Category suggestions:** users may suggest a category (`category_suggestions`). Adding a new category or moving one to a less strict tier requires an admin, a recorded reason, and for anything in §3 a legal, insurance and safety assessment (master spec §6).

## 5. Demo content check

The prototype's demo data includes a wanted listing for a **minigraver** (mini-excavator). Under this
policy it is prohibited, so it must not be seeded. The chainsaw (`motorsag`), wood splitter, snow blower
and scaffold demos go to restricted categories. Both trailer demos and the kayak/SUP demos go to
categories where paid rental is off (D-028) unless the owner decides otherwise.
