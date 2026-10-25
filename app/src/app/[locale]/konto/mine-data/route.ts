import { redirect } from "next/navigation";
import { localePath } from "@/i18n/page";
import { getActor } from "@/modules/auth/actor";
import { isAppError } from "@/modules/errors";
import { buildDataExport } from "@/modules/privacy/export";

/**
 * «Last ned mine data» (P03-06): the signed-in person's own data as a JSON file. A read-only GET, so a
 * cross-site page cannot read the response; each export is audited and limited to five a day.
 */
export async function GET(_req: Request, ctx: RouteContext<"/[locale]/konto/mine-data">) {
  const { locale } = await ctx.params;
  const actor = await getActor();
  if (actor.kind !== "user") {
    redirect(`${localePath(locale, "/logg-inn")}?neste=${encodeURIComponent(localePath(locale, "/konto"))}`);
  }
  let data;
  try {
    data = await buildDataExport(actor);
  } catch (err) {
    if (isAppError(err) && err.code === "rate_limited") redirect(`${localePath(locale, "/konto")}?eksport=grense`);
    throw err;
  }
  const day = data.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="laandet-mine-data-${day}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
