import { getTranslations } from "next-intl/server";
import type { BookingStatus } from "@/db/schema";

const TONE: Partial<Record<BookingStatus, string>> = {
  requested: "badge-warning",
  accepted: "badge-warning",
  not_returned: "badge-danger",
  disputed: "badge-danger",
};

export async function StatusBadge({ status }: { status: BookingStatus }) {
  const t = await getTranslations("inbox");
  return <span className={`badge ${TONE[status] ?? ""}`}>{t(`bookingStatus.${status}`)}</span>;
}
