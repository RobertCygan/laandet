import { afterAll, vi } from "vitest";
import { applyTestEnv } from "./env";

applyTestEnv();

// Services read request metadata through next/headers; outside Next there is no request.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "vitest" }),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => undefined,
    delete: () => undefined,
    has: () => false,
  }),
}));

afterAll(async () => {
  const pool = (globalThis as { __laandetPool?: { end(): Promise<void> } }).__laandetPool;
  await pool?.end();
  (globalThis as { __laandetPool?: unknown }).__laandetPool = undefined;
});
