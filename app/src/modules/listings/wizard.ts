import { oreToInput } from "@/i18n/format";
import type { WizardCategory, WizardInitial } from "@/ui/listings/ListingWizard";
import { listCategories, listLocalities, type ListingDetail } from "./queries";

/** Options for the listing wizard (prohibited categories are never offered). */
export async function wizardOptions(): Promise<{ categories: WizardCategory[]; localities: { id: string; name: string }[] }> {
  const [cats, locs] = await Promise.all([listCategories(), listLocalities()]);
  return {
    categories: cats.map((c) => ({
      id: c.id,
      labels: c.labels,
      policy: c.policy,
      safetyNotice: c.safetyNotice,
      allowPaidRental: c.allowPaidRental,
      allowedListingTypes: c.allowedListingTypes,
    })),
    localities: locs.map((l) => ({ id: l.id, name: l.name })),
  };
}

export function emptyInitial(type?: WizardInitial["type"]): WizardInitial {
  return {
    type,
    text: {},
    freeLoan: false,
    handoverPickup: true,
    handoverOwnerDelivery: false,
    handoverMeet: false,
    restrictedAck: false,
    images: [],
  };
}

export function initialFromListing(d: NonNullable<ListingDetail>): WizardInitial {
  const l = d.listing;
  const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    listingId: l.id,
    status: l.status,
    type: l.type,
    categoryId: l.categoryId,
    localityId: l.localityId,
    text: {
      title: l.title,
      description: l.description,
      itemCondition: str(l.itemCondition),
      knownDefects: str(l.knownDefects),
      accessories: (l.includedAccessories ?? []).join("\n"),
      price: l.priceOre ? oreToInput(l.priceOre) : "",
      priceUnit: str(l.priceUnit),
      declaredValue: oreToInput(l.declaredValueOre),
      deposit: oreToInput(l.depositOre),
      usageRestrictions: str(l.usageRestrictions),
      operatingInstructions: str(l.operatingInstructions),
      wantedFrom: str(l.wantedFrom),
      wantedTo: str(l.wantedTo),
      budget: oreToInput(l.budgetOre),
      areaNote: str(l.areaNote),
      deliveryFee: oreToInput(l.deliveryFeeOre),
      deliveryRadiusKm: str(l.deliveryRadiusKm),
      meetingAreaNote: str(l.meetingAreaNote),
    },
    freeLoan: l.type === "rent_out" && l.priceOre === 0,
    handoverPickup: l.handoverPickup,
    handoverOwnerDelivery: l.handoverOwnerDelivery,
    handoverMeet: l.handoverMeet,
    restrictedAck: Boolean(l.restrictedAckAt),
    images: d.images.map((i) => ({ id: i.mediaId, alt: i.altText ?? "" })),
  };
}
