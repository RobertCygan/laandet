import type { CategoryPolicy, LocalizedText } from "./schema";

export const LOCALITIES = [
  { slug: "leinesfjord", name: "Leinesfjord" },
  { slug: "leines", name: "Leines" },
  { slug: "nordfold", name: "Nordfold" },
  { slug: "engeloya", name: "Engeløya" },
  { slug: "nordskot", name: "Nordskot" },
  { slug: "bogoy", name: "Bogøy" },
  { slug: "helnessund", name: "Helnessund" },
  { slug: "bogen", name: "Bogen" },
] as const;

type CategorySeed = {
  slug: string;
  parent?: string;
  labels: LocalizedText;
  icon: string;
  policy: CategoryPolicy;
  allowPaidRental?: boolean;
  safetyNotice?: LocalizedText;
  /** Default: the three item types. Service categories (D-063) take only the two service types. */
  allowedListingTypes?: string[];
};

const SERVICE = ["service_offer", "service_wanted"];

// Initial taxonomy from docs/PROHIBITED_ITEMS.md §2. Editable by admins afterwards.
export const CATEGORIES: CategorySeed[] = [
  { slug: "verktoy", labels: { nb: "Verktøy", en: "Tools" }, icon: "drill", policy: "allowed" },
  {
    slug: "bygg",
    labels: { nb: "Bygg og oppussing", en: "Building and renovation" },
    icon: "hammer",
    policy: "allowed",
  },
  {
    slug: "stiger-stillas",
    labels: { nb: "Stiger og stillas", en: "Ladders and scaffolding" },
    icon: "construction",
    policy: "restricted",
    safetyNotice: {
      nb: "Fare for fall. Bruk stillaset på fast og plant underlag, følg monteringsveiledningen og grensen for maks høyde.",
      en: "Risk of falling. Use the scaffold on firm, level ground and follow the assembly instructions and the maximum height.",
    },
  },
  { slug: "hage", labels: { nb: "Hage", en: "Garden" }, icon: "trees", policy: "allowed" },
  {
    slug: "motoriserte-redskaper",
    labels: {
      nb: "Motorsag, ryddesag, snøfreser og lignende",
      en: "Chainsaws, brush cutters, snow blowers and similar",
    },
    icon: "axe",
    policy: "restricted",
    safetyNotice: {
      nb: "Leietakeren må ha erfaring og riktig verneutstyr: sagbukse, hjelm, hansker og vern for øyne og hørsel. Lån eller lei aldri ut til personer under 18 år.",
      en: "The renter must have experience and the right protective equipment: chainsaw trousers, helmet, gloves, eye and hearing protection. Never lend or rent out to anyone under 18.",
    },
  },
  { slug: "rengjoring", labels: { nb: "Rengjøring", en: "Cleaning" }, icon: "sparkles", policy: "allowed" },
  {
    slug: "tilhengere",
    labels: { nb: "Tilhengere", en: "Trailers" },
    icon: "truck",
    policy: "restricted",
    allowPaidRental: false,
    safetyNotice: {
      nb: "Leietakeren må ha riktig førerkortklasse (B eller BE), og bilen må tåle vekten av hengeren. Sjekk lys, dekk og eventuell EU-kontroll.",
      en: "The renter must hold the right driving licence class (B or BE), and the car must be rated for the trailer's weight. Check lights, tyres and any required inspection.",
    },
  },
  {
    slug: "transporttilbehor",
    labels: { nb: "Takbokser og transporttilbehør", en: "Roof boxes and transport accessories" },
    icon: "package",
    policy: "allowed",
  },
  {
    slug: "sykler",
    labels: { nb: "Sykler og sykkelutstyr", en: "Bicycles and cycling equipment" },
    icon: "bike",
    policy: "allowed",
    allowPaidRental: false,
  },
  {
    slug: "vinter",
    labels: { nb: "Ski, snowboard og akebrett", en: "Skis, snowboards and sledges" },
    icon: "snowflake",
    policy: "allowed",
  },
  {
    slug: "friluft",
    labels: { nb: "Friluftsliv og camping", en: "Outdoor and camping" },
    icon: "tent",
    policy: "allowed",
  },
  {
    slug: "padling",
    labels: { nb: "Kajakk, kano og SUP", en: "Kayaks, canoes and SUP" },
    icon: "sailboat",
    policy: "restricted",
    allowPaidRental: false,
    safetyNotice: {
      nb: "Alle må ha flytevest. Ta hensyn til vær, vind og kaldt vann. Padle aldri alene i kaldt vann.",
      en: "Everyone must wear a life jacket. Consider weather, wind and cold water. Never paddle alone in cold water.",
    },
  },
  { slug: "sport", labels: { nb: "Sport og fritid", en: "Sport and leisure" }, icon: "dumbbell", policy: "allowed" },
  {
    slug: "elektronikk",
    labels: { nb: "Elektronikk og projektorer", en: "Electronics and projectors" },
    icon: "monitor",
    policy: "allowed",
  },
  { slug: "foto-video", labels: { nb: "Foto og video", en: "Photo and video" }, icon: "camera", policy: "allowed" },
  {
    slug: "fest",
    labels: { nb: "Fest og arrangement", en: "Party and events" },
    icon: "party-popper",
    policy: "allowed",
  },
  {
    slug: "grill-gass",
    labels: { nb: "Grill og gassutstyr", en: "Grills and gas equipment" },
    icon: "flame",
    policy: "restricted",
    safetyNotice: {
      nb: "Sjekk slange og regulator, og test for lekkasje. Bruk utstyret bare utendørs. Transporter gassflasker stående.",
      en: "Check the hose and regulator and test for leaks. Use outdoors only. Transport gas bottles upright.",
    },
  },
  {
    slug: "husholdning",
    labels: { nb: "Husholdning og kjøkken", en: "Household and kitchen" },
    icon: "house",
    policy: "allowed",
  },
  { slug: "mobler", labels: { nb: "Møbler", en: "Furniture" }, icon: "sofa", policy: "allowed" },
  {
    slug: "klaer",
    labels: { nb: "Klær og tilbehør", en: "Clothing and accessories" },
    icon: "shirt",
    policy: "allowed",
  },
  { slug: "barn", labels: { nb: "Barn og familie", en: "Children and family" }, icon: "baby", policy: "allowed" },
  {
    slug: "barn-bilseter",
    parent: "barn",
    labels: { nb: "Bilseter for barn", en: "Child car seats" },
    icon: "baby",
    policy: "restricted",
    safetyNotice: {
      nb: "Skriv om setet har vært med i en kollisjon, og når det er produsert eller går ut på dato. Gi aldri bort et bilsete som har vært med i en kollisjon.",
      en: "State whether the seat has been in a collision, and its production or expiry date. Never give away a seat that has been in a collision.",
    },
  },
  { slug: "annet", labels: { nb: "Annet", en: "Other" }, icon: "box", policy: "allowed" },
  // Tjenester (D-063). Electrical work, work on roofs and gas, chimney or fireplace work may not be
  // offered (PROHIBITED_ITEMS.md, terms); the screening keywords below flag such listings for review.
  {
    slug: "tjeneste-hage",
    labels: { nb: "Hagearbeid og plenklipping", en: "Garden work and lawn mowing" },
    icon: "trees",
    policy: "allowed",
    allowedListingTypes: SERVICE,
  },
  {
    slug: "tjeneste-snomaking",
    labels: { nb: "Snømåking på bakken", en: "Snow clearing on the ground" },
    icon: "snowflake",
    policy: "restricted",
    allowedListingTypes: SERVICE,
    safetyNotice: {
      nb: "Bare snømåking på bakken: innkjørsel, gårdsplass, trapp. Snømåking på tak er ikke tillatt på Laandet.",
      en: "Only clearing snow on the ground: driveway, yard, steps. Clearing snow from roofs is not allowed on Laandet.",
    },
  },
  {
    slug: "tjeneste-flytting",
    labels: { nb: "Flytting og transport", en: "Moving and transport" },
    icon: "truck",
    policy: "allowed",
    allowedListingTypes: SERVICE,
  },
  {
    slug: "tjeneste-rengjoring",
    labels: { nb: "Vask og rengjøring", en: "Washing and cleaning" },
    icon: "sparkles",
    policy: "allowed",
    allowedListingTypes: SERVICE,
  },
  {
    slug: "tjeneste-smaareparasjoner",
    labels: { nb: "Småreparasjoner og montering", en: "Small repairs and assembly" },
    icon: "hammer",
    policy: "restricted",
    allowedListingTypes: SERVICE,
    safetyNotice: {
      nb: "Ikke elektrisk arbeid, rørlegging i vegg, gass, pipe eller ildsted. Slikt arbeid krever autorisasjon.",
      en: "No electrical work, plumbing inside walls, gas, chimney or fireplace work. Such work requires authorisation.",
    },
  },
  {
    slug: "tjeneste-dyrepass",
    labels: { nb: "Dyrepass og lufting", en: "Pet care and walking" },
    icon: "paw-print",
    policy: "allowed",
    allowedListingTypes: SERVICE,
  },
  {
    slug: "tjeneste-kurs",
    labels: { nb: "Kurs og aktiviteter", en: "Courses and activities" },
    icon: "dumbbell",
    policy: "allowed",
    allowedListingTypes: SERVICE,
  },
  {
    slug: "tjeneste-annet",
    labels: { nb: "Annen hjelp", en: "Other help" },
    icon: "box",
    policy: "allowed",
    allowedListingTypes: SERVICE,
  },
];

// Hints only (PROHIBITED_ITEMS.md §4): a match queues an automatic report, never auto-removal.
export const SCREENING_KEYWORDS = [
  "snøscooter",
  "scooter med motor",
  "atv",
  "firehjuling",
  "motorsykkel",
  "moped",
  "båtmotor",
  "påhengsmotor",
  "vannscooter",
  "motorbåt",
  "gravemaskin",
  "minigraver",
  "hjullaster",
  "lift",
  "drone",
  "gevær",
  "rifle",
  "hagle",
  "pistol",
  "ammunisjon",
  "luftgevær",
  "armbrøst",
  "fyrverkeri",
  "rakett",
  "krutt",
  "sprengstoff",
  "narkotika",
  "alkohol",
  "snus",
  "tobakk",
  "valp",
  "kattunge",
  "bolig",
  "hytte til leie",
  "parkeringsplass",
  "båtplass",
  // Services that may not be offered (D-063)
  "elektriker",
  "elektrisk arbeid",
  "el-arbeid",
  "sikringsskap",
  "takmåking",
  "måke tak",
  "snø på taket",
  "feiing",
  "barnepass",
  "barnevakt",
  "taxi",
  "skyss mot betaling",
  "pipe",
  "gassinstallasjon",
];
