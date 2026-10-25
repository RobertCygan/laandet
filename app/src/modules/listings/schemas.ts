import { z } from "zod";
import { ITEM_CONDITIONS, LISTING_TYPES, PRICE_UNITS } from "@/db/schema";
import { parseKrToOre } from "@/i18n/format";
import type { ListingDraft } from "./rules";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "too_long" })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const kr = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const ore = parseKrToOre(v);
    if (ore === null) {
      ctx.addIssue({ code: "custom", message: "amount_invalid" });
      return z.NEVER;
    }
    return ore;
  });

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

const isoDate = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "date_invalid" });
      return z.NEVER;
    }
    return v;
  });

/** Raw form fields (FormData strings) → validated values. */
export const listingFormSchema = z.object({
  type: z.enum(LISTING_TYPES, { error: "required" }),
  title: z.string().trim().min(3, { error: "title_length" }).max(90, { error: "title_length" }),
  description: z.string().trim().max(4000, { error: "description_length" }).default(""),
  categoryId: z.uuid({ error: "required" }),
  localityId: z.uuid({ error: "required" }),
  areaNote: text(80),
  itemCondition: z
    .enum(ITEM_CONDITIONS)
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((v) => v ?? null),
  knownDefects: text(1000),
  freeLoan: checkbox,
  price: kr,
  priceUnit: z
    .enum(PRICE_UNITS)
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((v) => v ?? null),
  declaredValue: kr,
  deposit: kr,
  usageRestrictions: text(1000),
  accessories: z.string().max(2000).optional().default(""),
  operatingInstructions: text(2000),
  wantedFrom: isoDate,
  wantedTo: isoDate,
  budget: kr,
  handoverPickup: checkbox,
  handoverOwnerDelivery: checkbox,
  deliveryFee: kr,
  deliveryRadiusKm: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: "radius_range" });
        return z.NEVER;
      }
      return n;
    }),
  handoverMeet: checkbox,
  meetingAreaNote: text(80),
  restrictedAck: checkbox,
});

export type ListingFormValues = z.infer<typeof listingFormSchema>;

/** Keep only the fields that belong to the listing type (DB checks forbid the others). */
export function toDraft(v: ListingFormValues, imageCount: number): ListingDraft {
  const offer = v.type !== "wanted";
  const rent = v.type === "rent_out";
  const accessories = v.accessories
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((s) => s.slice(0, 80));
  return {
    type: v.type,
    title: v.title,
    description: v.description,
    categoryId: v.categoryId,
    localityId: v.localityId,
    areaNote: v.areaNote,
    itemCondition: offer ? v.itemCondition : null,
    knownDefects: offer ? v.knownDefects : null,
    priceOre: rent ? (v.freeLoan ? 0 : v.price) : null,
    priceUnit: rent ? (v.priceUnit ?? (v.freeLoan ? "day" : null)) : null,
    declaredValueOre: rent ? v.declaredValue : null,
    depositOre: rent ? (v.deposit && v.deposit > 0 ? v.deposit : null) : null,
    usageRestrictions: rent ? v.usageRestrictions : null,
    includedAccessories: rent ? accessories : [],
    operatingInstructions: rent ? v.operatingInstructions : null,
    wantedFrom: v.type === "wanted" ? v.wantedFrom : null,
    wantedTo: v.type === "wanted" ? v.wantedTo : null,
    budgetOre: v.type === "wanted" ? v.budget : null,
    handoverPickup: v.handoverPickup,
    handoverOwnerDelivery: v.handoverOwnerDelivery,
    deliveryFeeOre: v.handoverOwnerDelivery ? v.deliveryFee : null,
    deliveryRadiusKm: v.handoverOwnerDelivery ? v.deliveryRadiusKm : null,
    handoverMeet: v.handoverMeet,
    meetingAreaNote: v.handoverMeet ? v.meetingAreaNote : null,
    restrictedAck: v.restrictedAck,
    imageCount,
  };
}
