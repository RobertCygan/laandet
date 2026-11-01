import { describe, expect, it } from "vitest";
import {
  classifyValue,
  containsContactInfo,
  matchScreeningKeywords,
  publishViolations,
  storageViolations,
  type CategoryRules,
  type ListingDraft,
} from "./rules";

const category = (o: Partial<CategoryRules> = {}): CategoryRules => ({
  id: "c",
  policy: "allowed",
  allowPaidRental: true,
  allowedListingTypes: ["rent_out", "wanted", "give_away"],
  active: true,
  ...o,
});

const rental = (o: Partial<ListingDraft> = {}): ListingDraft => ({
  type: "rent_out",
  title: "Slagdrill",
  description: "Solid slagdrill med koffert og bor.",
  categoryId: "c",
  localityId: "l",
  areaNote: null,
  itemCondition: "good",
  knownDefects: null,
  priceOre: 10000,
  priceUnit: "day",
  declaredValueOre: 300000,
  depositOre: null,
  usageRestrictions: null,
  includedAccessories: [],
  operatingInstructions: null,
  wantedFrom: null,
  wantedTo: null,
  budgetOre: null,
  handoverPickup: true,
  handoverOwnerDelivery: false,
  deliveryFeeOre: null,
  deliveryRadiusKm: null,
  handoverMeet: false,
  meetingAreaNote: null,
  restrictedAck: false,
  imageCount: 1,
  ...o,
});

const codes = (d: ListingDraft, c: CategoryRules | null = category(), preview = false) =>
  publishViolations(d, c, { highValuePreview: preview }).map((x) => x.code);

describe("classifyValue (5 000 kr threshold)", () => {
  it.each([
    [499_999, "A"],
    [500_000, "A"],
    [500_001, "B"],
  ])("%i øre → %s", (ore, expected) => expect(classifyValue(ore)).toBe(expected));
});

describe("publishViolations", () => {
  it("accepts a complete rental", () => expect(codes(rental())).toEqual([]));
  it("blocks category B unless the preview flag is on (D-011)", () => {
    expect(codes(rental({ declaredValueOre: 500_001 }))).toContain("high_value_blocked");
    expect(codes(rental({ declaredValueOre: 500_001 }), category(), true)).not.toContain("high_value_blocked");
  });
  it("rejects a deposit above the declared value", () => {
    expect(codes(rental({ depositOre: 400000 }))).toContain("deposit_above_value");
  });
  it("rejects paid rental where only free lending is allowed (D-028)", () => {
    expect(codes(rental(), category({ allowPaidRental: false }))).toContain("paid_rental_not_allowed");
    expect(codes(rental({ priceOre: 0 }), category({ allowPaidRental: false }))).toEqual([]);
  });
  it("requires the safety acknowledgement in restricted categories", () => {
    expect(codes(rental(), category({ policy: "restricted" }))).toContain("restricted_ack_required");
    expect(codes(rental({ restrictedAck: true }), category({ policy: "restricted" }))).toEqual([]);
  });
  it("rejects prohibited categories", () => {
    expect(codes(rental(), category({ policy: "prohibited" }))).toContain("category_not_allowed");
  });
  it("requires known defects for giveaways", () => {
    const give = rental({ type: "give_away", priceOre: null, priceUnit: null, declaredValueOre: null });
    expect(codes(give)).toContain("known_defects_required");
    expect(codes({ ...give, knownDefects: "Ingen kjente feil" })).toEqual([]);
  });
  it("requires at least one handover option for offers, not for wanted", () => {
    expect(codes(rental({ handoverPickup: false }))).toContain("handover_required");
    const wanted = rental({
      type: "wanted",
      priceOre: null,
      priceUnit: null,
      declaredValueOre: null,
      handoverPickup: false,
    });
    expect(codes(wanted)).toEqual([]);
  });
  it("rejects contact info in titles", () => {
    expect(codes(rental({ title: "Drill – ring 912 34 567" }))).toContain("title_contact_info");
  });
  it("rejects more than 8 images", () => {
    expect(codes(rental({ imageCount: 9 }))).toContain("too_many_images");
  });
});

describe("contact info and screening", () => {
  it("detects links, emails and Norwegian phone numbers", () => {
    expect(containsContactInfo("se www.example.com")).toBe(true);
    expect(containsContactInfo("ola@example.no")).toBe(true);
    expect(containsContactInfo("ring +47 912 34 567")).toBe(true);
    expect(containsContactInfo("Totalvekt 750 kg")).toBe(false);
  });
  it("matches whole words only", () => {
    const kw = ["drone", "atv", "snøscooter"];
    expect(matchScreeningKeywords("Selger SNØSCOOTER", kw)).toEqual(["snøscooter"]);
    expect(matchScreeningKeywords("Kreativ tegnesett", kw)).toEqual([]);
    expect(matchScreeningKeywords("Drone med kamera", kw)).toEqual(["drone"]);
  });
});

describe("storageViolations (apply to drafts too)", () => {
  it("accepts an incomplete but storable draft", () => {
    expect(storageViolations(rental({ priceOre: null, declaredValueOre: null, itemCondition: null }))).toEqual([]);
  });
  it("mirrors the database checks", () => {
    const c = (d: ListingDraft) => storageViolations(d).map((x) => x.code);
    expect(c(rental({ declaredValueOre: 0 }))).toContain("declared_value_required");
    expect(c(rental({ depositOre: 400000, declaredValueOre: 300000 }))).toContain("deposit_above_value");
    expect(c(rental({ handoverOwnerDelivery: true, deliveryRadiusKm: 0 }))).toContain("radius_range");
    expect(c(rental({ type: "wanted", wantedFrom: "2026-12-10", wantedTo: "2026-12-01" }))).toContain("dates_order");
  });
});
