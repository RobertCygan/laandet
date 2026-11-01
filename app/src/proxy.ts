import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request:
 * 1. Per-request CSP nonce (docs/SECURITY.md SEC-03). Next.js reads the nonce from the
 *    request's Content-Security-Policy header and applies it to its own scripts.
 * 2. Locale routing: nb has no prefix (rewritten to /nb/...), English lives under /en.
 *    /nb/... is redirected to the canonical unprefixed URL.
 * 3. A request id for logs and audit events.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/nb" || pathname.startsWith("/nb/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    url.search = search;
    return NextResponse.redirect(url, 308);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set("x-request-id", crypto.randomUUID());

  let response: NextResponse;
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = `/nb${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const https = (process.env.APP_URL ?? "").startsWith("https://");
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Dev tooling injects styles without a nonce; production uses only nonced/linked styles.
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
  ];
  if (https) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export const config = {
  matcher: [
    // Pages only: not API routes, Next.js internals, media, health check or static files.
    "/((?!api/|_next/|media/|healthz|favicon\\.svg|robots\\.txt|images/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml|woff2?)$).*)",
  ],
};
