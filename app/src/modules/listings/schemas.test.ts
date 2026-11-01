import { describe, expect, it } from "vitest";
import { listingFormSchema, toDraft } from "./schemas";

const form = (o: Record<string, string>) =>
  listingFormSchema.parse({
    title: "Snømåking i Nordfold",
    description: "Jeg måker innkjørsler med snøfreser.",
    categoryId: "00000000-0000-4000-8000-000000000001",
    localityId: "00000000-0000-4000-8000-000000000002",
    handoverPickup: "on",
    handoverMeet: "on",
    itemCondition: "good",
    declaredValue: "500",
    ...o,
  });

describe("service form values (D-063)", () => {
  it("keeps price and unit, and drops item terms and handover", () => {
    const d = toDraft(form({ type: "service_offer", price: "350", priceUnit: "hour" }), 0);
    expect(d).toMatchObject({
      priceOre: 35000,
      priceUnit: "hour",
      itemCondition: null,
      declaredValueOre: null,
      handoverPickup: false,
      handoverMeet: false,
    });
  });

  it("free → 0 without a unit; no amount → «etter avtale» (null)", () => {
    expect(toDraft(form({ type: "service_wanted", freeLoan: "on", priceUnit: "job" }), 0)).toMatchObject({
      priceOre: 0,
      priceUnit: null,
    });
    expect(toDraft(form({ type: "service_offer", priceUnit: "sqm" }), 0)).toMatchObject({
      priceOre: null,
      priceUnit: null,
    });
  });
});
