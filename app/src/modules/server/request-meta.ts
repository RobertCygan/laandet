import { createHmac } from "node:crypto";
import { env } from "@/modules/config/env";

export type RequestMeta = {
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
};

/** Reads request metadata from Next.js headers (server components / actions only). */
export async function getRequestMeta(): Promise<RequestMeta> {
  const { headers } = await import("next/headers");
  const h = await headers();
  return metaFromHeaders(h);
}

export function metaFromHeaders(h: Headers): RequestMeta {
  // Behind Caddy the client IP is the first X-Forwarded-For entry (Caddy overwrites the header).
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    requestId: h.get("x-request-id"),
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

/** HMAC of the IP so logs can correlate abuse without storing raw IPs (SEC-43). */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHmac("sha256", env().IP_HASH_KEY).update(ip).digest("hex");
}
