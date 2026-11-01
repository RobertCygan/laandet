import { redirect } from "next/navigation";
import { localePath, pageLocale } from "@/i18n/page";

/** Short link used in the footer and on posters. */
export default async function GiveAwayPage({ params }: PageProps<"/[locale]/gis-bort">) {
  const locale = await pageLocale(params);
  redirect(`${localePath(locale, "/utforsk")}?type=give_away`);
}
