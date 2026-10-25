import type { HandoverMethod } from "@/db/schema";
import { formatDate, formatDateTime, formatKr } from "@/i18n/format";

/** Deadlines written into the agreement (CONDITION_REPORTS §7, RENTAL_AGREEMENTS §4). */
export const DEADLINES = {
  visibleDamageHours: 48,
  hiddenDefectDays: 14,
  returnConfirmHours: 72,
  depositClaimHours: 48,
};

export type Party = { userId: string; displayName: string; platformId: string };

/** Typed snapshot the agreement is rendered from (RENTAL_AGREEMENTS §2). Stored as `contracts.terms`. */
export type RentalTerms = {
  kind: "rental_simple";
  agreementNumber: string;
  templateVersion: string;
  revision: number;
  owner: Party;
  renter: Party;
  item: {
    title: string;
    description: string;
    categoryLabelNb: string;
    categoryLabelEn: string;
    condition: string | null;
    knownDefects: string | null;
  };
  declaredValueOre: number;
  price: { amountOre: number; unit: "hour" | "day" | "weekend" | "week"; units: number; totalOre: number };
  period: { start: string; end: string };
  handover: { method: HandoverMethod; deliveryFeeOre: number | null };
  return: { method: HandoverMethod };
  accessories: string[];
  depositOre: number;
  permittedUse: string | null;
  operatingInstructions: string | null;
  safetyNoticeNb: string | null;
  safetyNoticeEn: string | null;
  deadlines: typeof DEADLINES;
};

export type GiveawayTerms = {
  kind: "giveaway_transfer";
  agreementNumber: string;
  templateVersion: string;
  revision: number;
  giver: Party;
  recipient: Party;
  item: { title: string; description: string; condition: string | null; knownDefects: string | null };
  handover: { method: HandoverMethod | null; date: string };
};

export type ContractTerms = RentalTerms | GiveawayTerms;

/** Short public id shown in agreements instead of an email («Laandet-ID»). */
export function platformId(userId: string): string {
  return `L-${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** Material terms (RENTAL_AGREEMENTS §3.4): any change needs a new revision accepted by both. */
export const MATERIAL_FIELDS = [
  "period",
  "price",
  "depositOre",
  "handover",
  "return",
  "accessories",
  "permittedUse",
] as const;

export function materialChanges(a: RentalTerms, b: RentalTerms): string[] {
  return MATERIAL_FIELDS.filter((f) => JSON.stringify(a[f]) !== JSON.stringify(b[f]));
}

type Loc = "nb" | "en";
const L = <T>(locale: Loc, nb: T, en: T) => (locale === "nb" ? nb : en);

const UNIT = {
  hour: { nb: ["time", "timer"], en: ["hour", "hours"] },
  day: { nb: ["dag", "dager"], en: ["day", "days"] },
  weekend: { nb: ["helg", "helger"], en: ["weekend", "weekends"] },
  week: { nb: ["uke", "uker"], en: ["week", "weeks"] },
} as const;

const METHOD = {
  pickup: { nb: "Hentes av leietaker", en: "Collected by the renter" },
  owner_delivery: { nb: "Leveres av utleier", en: "Delivered by the owner" },
  meet: { nb: "Møtes på avtalt sted", en: "Meet at an agreed place" },
} as const;

const RETURN_METHOD = {
  pickup: { nb: "Leietaker leverer tilbake", en: "The renter brings it back" },
  owner_delivery: { nb: "Utleier henter", en: "The owner collects it" },
  meet: { nb: "Møtes på avtalt sted", en: "Meet at an agreed place" },
} as const;

const CONDITION = {
  new: { nb: "Ny", en: "New" },
  as_new: { nb: "Som ny", en: "As new" },
  good: { nb: "God", en: "Good" },
  fair: { nb: "Brukbar", en: "Fair" },
  worn: { nb: "Slitt", en: "Worn" },
  defective: { nb: "Har feil", en: "Has faults" },
} as const;

const conditionLabel = (c: string | null, locale: Loc) =>
  c && c in CONDITION ? CONDITION[c as keyof typeof CONDITION][locale] : "–";

/**
 * Template view (RENTAL_AGREEMENTS §2): every value pre-formatted; field names match the tags in
 * legal/{nb,en}/*.md. Money as «1 500 kr», times as «14.12.2026 kl. 10:00» (Europe/Oslo).
 */
export function toContractView(terms: ContractTerms, locale: Loc): Record<string, unknown> {
  const base = {
    agreementNumber: terms.agreementNumber,
    templateVersion: terms.templateVersion,
    revision: terms.revision,
  };
  if (terms.kind === "giveaway_transfer") {
    return {
      ...base,
      giver: terms.giver,
      recipient: terms.recipient,
      item: {
        title: terms.item.title,
        description: terms.item.description,
        condition: conditionLabel(terms.item.condition, locale),
        knownDefects: terms.item.knownDefects ?? L(locale, "Ingen oppgitt", "None stated"),
      },
      handover: {
        summary: terms.handover.method
          ? METHOD[terms.handover.method][locale]
          : L(locale, "Avtales i meldinger", "Agreed in messages"),
        date: terms.handover.date,
      },
    };
  }
  const isFree = terms.price.amountOre === 0;
  const [unitOne, unitMany] = UNIT[terms.price.unit][locale];
  const deposit = terms.depositOre > 0;
  return {
    ...base,
    owner: terms.owner,
    renter: terms.renter,
    item: {
      title: terms.item.title,
      description: terms.item.description,
      categoryLabel: L(locale, terms.item.categoryLabelNb, terms.item.categoryLabelEn),
      // Serial number / distinctive marks: optional in category A, required for category B (Phase 05).
      identifier: null,
      condition: conditionLabel(terms.item.condition, locale),
      knownDefects: terms.item.knownDefects,
    },
    declaredValue: formatKr(terms.declaredValueOre),
    period: {
      start: formatDateTime(new Date(terms.period.start), locale),
      end: formatDateTime(new Date(terms.period.end), locale),
    },
    price: {
      isFree,
      amount: formatKr(terms.price.amountOre),
      unitLabel: unitOne,
      unitLabelPlural: terms.price.units === 1 ? unitOne : unitMany,
      units: terms.price.units,
      total: isFree ? L(locale, "0 kr (gratis utlån)", "0 kr (free loan)") : formatKr(terms.price.totalOre),
    },
    deposit: {
      required: deposit,
      amount: formatKr(terms.depositOre),
      summary: deposit ? formatKr(terms.depositOre) : L(locale, "Ingen depositum", "No deposit"),
      paymentNote: L(
        locale,
        "for eksempel kontant, med Vipps eller med bankoverføring",
        "for example in cash, with Vipps or by bank transfer",
      ),
    },
    handover: {
      summary: METHOD[terms.handover.method][locale],
      deliveryFee:
        terms.handover.method === "owner_delivery" && terms.handover.deliveryFeeOre
          ? formatKr(terms.handover.deliveryFeeOre)
          : null,
    },
    return: { summary: RETURN_METHOD[terms.return.method][locale] },
    accessories: terms.accessories,
    permittedUse: terms.permittedUse,
    operatingInstructions: terms.operatingInstructions,
    safetyNotice: L(locale, terms.safetyNoticeNb, terms.safetyNoticeEn),
    deadlines: terms.deadlines,
  };
}

export const todayLabel = (d = new Date()) => formatDate(d);
