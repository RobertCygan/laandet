import type { ItemCondition, ListingType, PriceUnit } from "@/db/schema";

/** Internal platform threshold (master spec §10): declared value ≤ 5 000 kr → A, above → B. */
export const CATEGORY_A_MAX_ORE = 500_000;
export const MAX_DECLARED_VALUE_ORE = 100_000_000; // 1 000 000 kr sanity cap
export const MAX_IMAGES = 8;

export type ValueCategory = "A" | "B";

export function classifyValue(declaredValueOre: number): ValueCategory {
  return declaredValueOre <= CATEGORY_A_MAX_ORE ? "A" : "B";
}

export type CategoryRules = {
  id: string;
  policy: "allowed" | "restricted" | "prohibited";
  allowPaidRental: boolean;
  allowedListingTypes: string[];
  active: boolean;
};

/** Normalised listing values as stored (money in øre). */
export type ListingDraft = {
  type: ListingType;
  title: string;
  description: string;
  categoryId: string;
  localityId: string;
  areaNote: string | null;
  itemCondition: ItemCondition | null;
  knownDefects: string | null;
  priceOre: number | null;
  priceUnit: PriceUnit | null;
  declaredValueOre: number | null;
  depositOre: number | null;
  usageRestrictions: string | null;
  includedAccessories: string[];
  operatingInstructions: string | null;
  wantedFrom: string | null;
  wantedTo: string | null;
  budgetOre: number | null;
  handoverPickup: boolean;
  handoverOwnerDelivery: boolean;
  deliveryFeeOre: number | null;
  deliveryRadiusKm: number | null;
  handoverMeet: boolean;
  meetingAreaNote: string | null;
  restrictedAck: boolean;
  imageCount: number;
};

const URL_RE = /(https?:\/\/|www\.)\S+/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?47[\s-]?)?(?:\d[\s-]?){8}\b/;

/** Links, emails or phone numbers (contact goes through messages after agreement). */
export function containsContactInfo(text: string): boolean {
  return URL_RE.test(text) || EMAIL_RE.test(text) || PHONE_RE.test(text);
}

/** Keyword hints for prohibited items (whole-word, case-insensitive). */
export function matchScreeningKeywords(text: string, keywords: string[]): string[] {
  const lower = ` ${text.toLowerCase()} `;
  return keywords.filter((k) => {
    const re = new RegExp(
      `(^|[^\\p{L}\\p{N}])${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`,
      "u",
    );
    return re.test(lower);
  });
}

export type RuleViolation = { field: string; code: string };

/**
 * Rules that apply to every save, drafts included. They mirror the database CHECK
 * constraints so a bad value becomes a field error instead of a failed insert.
 */
export function storageViolations(d: ListingDraft): RuleViolation[] {
  const v: RuleViolation[] = [];
  if (d.declaredValueOre !== null && d.declaredValueOre <= 0)
    v.push({ field: "declaredValue", code: "declared_value_required" });
  if (d.declaredValueOre !== null && d.declaredValueOre > MAX_DECLARED_VALUE_ORE)
    v.push({ field: "declaredValue", code: "declared_value_too_high" });
  if (d.depositOre !== null && d.declaredValueOre !== null && d.depositOre > d.declaredValueOre) {
    v.push({ field: "deposit", code: "deposit_above_value" });
  }
  if (d.deliveryRadiusKm !== null && (d.deliveryRadiusKm < 1 || d.deliveryRadiusKm > 300)) {
    v.push({ field: "deliveryRadiusKm", code: "radius_range" });
  }
  if (d.wantedFrom && d.wantedTo && d.wantedTo < d.wantedFrom) v.push({ field: "wantedTo", code: "dates_order" });
  return v;
}

/**
 * Rules for publishing (and for saving an already published listing). Drafts only need a
 * title and a type. Returns all violations so the form can show every problem at once.
 */
export function publishViolations(
  d: ListingDraft,
  category: CategoryRules | null,
  opts: { highValuePreview: boolean },
): RuleViolation[] {
  const v: RuleViolation[] = [];
  const add = (field: string, code: string) => v.push({ field, code });

  if (d.title.length < 3 || d.title.length > 90) add("title", "title_length");
  if (containsContactInfo(d.title)) add("title", "title_contact_info");
  if (d.description.length < 10 || d.description.length > 4000) add("description", "description_length");
  if (!category || !category.active || category.policy === "prohibited") add("categoryId", "category_not_allowed");
  else if (!category.allowedListingTypes.includes(d.type)) add("categoryId", "category_type_not_allowed");
  if (category?.policy === "restricted" && !d.restrictedAck) add("restrictedAck", "restricted_ack_required");
  if (d.imageCount > MAX_IMAGES) add("images", "too_many_images");

  if (d.type === "rent_out") {
    if (!d.itemCondition) add("itemCondition", "required");
    if (!d.priceUnit) add("priceUnit", "required");
    if (d.priceOre === null || d.priceOre < 0) add("price", "price_required");
    if (d.declaredValueOre === null || d.declaredValueOre <= 0) add("declaredValue", "declared_value_required");
    else if (d.declaredValueOre > MAX_DECLARED_VALUE_ORE) add("declaredValue", "declared_value_too_high");
    else if (classifyValue(d.declaredValueOre) === "B" && !opts.highValuePreview)
      add("declaredValue", "high_value_blocked");
    if (d.depositOre !== null && d.declaredValueOre !== null && d.depositOre > d.declaredValueOre) {
      add("deposit", "deposit_above_value");
    }
    if (category && !category.allowPaidRental && (d.priceOre ?? 0) > 0) add("price", "paid_rental_not_allowed");
  }
  if (d.type === "give_away") {
    if (!d.itemCondition) add("itemCondition", "required");
    if (!d.knownDefects || d.knownDefects.trim().length < 2) add("knownDefects", "known_defects_required");
  }
  if (d.type === "wanted" && d.wantedFrom && d.wantedTo && d.wantedTo < d.wantedFrom) {
    add("wantedTo", "dates_order");
  }
  if (d.type !== "wanted" && !d.handoverPickup && !d.handoverOwnerDelivery && !d.handoverMeet) {
    add("handover", "handover_required");
  }
  if (d.deliveryRadiusKm !== null && (d.deliveryRadiusKm < 1 || d.deliveryRadiusKm > 300)) {
    add("deliveryRadiusKm", "radius_range");
  }
  return v;
}
