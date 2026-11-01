import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/modules/auth/auth";

const handler = toNextJsHandler(auth);

/**
 * Only the two links in our emails are served over HTTP. Every other auth operation goes
 * through our own Server Actions (src/modules/auth), which add the checks Better Auth does not
 * know about: profile and consent records, bot checks, per-account rate limits, re-authentication
 * for email changes and audit logging. Exposing the rest would let anyone skip those.
 */
const EMAIL_LINKS = [/^\/api\/auth\/verify-email$/, /^\/api\/auth\/reset-password\/[A-Za-z0-9_-]+$/];

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (!EMAIL_LINKS.some((re) => re.test(pathname))) return notFound();
  return handler.GET(request);
}

export async function POST(): Promise<Response> {
  return notFound();
}
