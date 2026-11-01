import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Static security headers. The Content-Security-Policy (with a per-request
// nonce) is set in src/proxy.ts. See docs/SECURITY.md SEC-02/SEC-03.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Every page is rendered per request (CSP nonce, session-aware header),
  // so Cache Components are not used in the MVP. See DECISIONS D-030.
  cacheComponents: false,
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      // One image per action call (10 MB) + multipart overhead.
      bodySizeLimit: "11mb",
    },
    // Requests pass through src/proxy.ts, which otherwise cuts bodies at 10 MB.
    proxyClientMaxBodySize: "11mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
