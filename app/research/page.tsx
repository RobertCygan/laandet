import type { Metadata } from "next";
import { Dashboard } from "@/components/research/Dashboard";
export const metadata: Metadata = {
  title: "Lokalt researchpanel",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Dashboard />;
}
