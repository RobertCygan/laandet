import type { Metadata } from "next";
import { CategoryDirectory } from "@/components/listings/CategoryDirectory";
export const metadata: Metadata = {
  title: "Alle kategorier",
  description:
    "Fra verktøy og tilhengere til friluftsliv og fest. Utforsk alle 19 utleiekategorier i Lånndets testversjon.",
};
export default function Page() {
  return <CategoryDirectory />;
}
