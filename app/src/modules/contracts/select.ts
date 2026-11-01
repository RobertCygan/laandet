import type { ContractKind } from "@/db/schema";
import { CATEGORY_A_MAX_ORE } from "@/modules/listings/rules";

/** Which document applies (RENTAL_AGREEMENTS §1). */
export function selectContractKind(listing: { type: string; declaredValueOre: number | null }): ContractKind {
  if (listing.type === "give_away") return "giveaway_transfer";
  if (listing.type !== "rent_out") throw new Error("no contract for wanted listings");
  if (listing.declaredValueOre === null) throw new Error("rental without declared value");
  return listing.declaredValueOre <= CATEGORY_A_MAX_ORE ? "rental_simple" : "rental_extended";
}
