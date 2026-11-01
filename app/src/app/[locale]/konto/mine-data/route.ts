import { NextResponse } from "next/server";
import { localePath } from "@/i18n/page";
import { getActor } from "@/modules/auth/actor";
import { isAppError } from "@/modules/errors";
import { buildDataExport } from "@/modules/privacy/export";

/** Same-origin check like the one Next.js applies to Server Actions (a form post from another site is refused). */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * «Last ned mine data» (P03-06): the signed-in person's own data as a JSON file. Each export is audited
 * and limited to five a day, so it is a POST from our own form, never a GET another site could trigger
 * (security review L4).
 */
export async function POST(req: Request, ctx: RouteContext<"/[locale]/konto/mine-data">) {
  const { locale } = await ctx.params;
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);
  const actor = await getActor();
  if (actor.kind !== "user") {
    return to(`${localePath(locale, "/logg-inn")}?neste=${encodeURIComponent(localePath(locale, "/konto"))}`);
  }
  let data;
  try {
    data = await buildDataExport(actor);
  } catch (err) {
    if (isAppError(err) && err.code === "rate_limited") return to(`${localePath(locale, "/konto")}?eksport=grense`);
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
