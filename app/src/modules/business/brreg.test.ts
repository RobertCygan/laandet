import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidOrgNumber, lookupOrganisation, normaliseOrgNumber } from "./brreg";

const API = "https://brreg.test/api";
const BRREG = "974760673"; // Brønnøysundregistrene's own number

function stubFetch(status: number, body?: unknown) {
  const fn = vi.fn<(url: string) => Promise<Response>>(
    async () => new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("org numbers and Enhetsregisteret (D-063)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("checks the modulus-11 digit", () => {
    expect(normaliseOrgNumber("974 760 673")).toBe(BRREG);
    expect(isValidOrgNumber(BRREG)).toBe(true);
    expect(isValidOrgNumber("974760674")).toBe(false);
    expect(isValidOrgNumber("12345678")).toBe(false);
  });

  it("returns the registered name of an active entity", async () => {
    const fetch = stubFetch(200, { organisasjonsnummer: BRREG, navn: "REGISTERENHETEN I BRØNNØYSUND" });
    await expect(lookupOrganisation(BRREG, API)).resolves.toEqual({ ok: true, name: "REGISTERENHETEN I BRØNNØYSUND" });
    expect(String(fetch.mock.calls[0]![0])).toMatch(/\/enheter\/974760673$/);
  });

  it("refuses unknown, deleted, bankrupt or dissolving entities, and reports a register outage", async () => {
    stubFetch(404);
    await expect(lookupOrganisation(BRREG, API)).resolves.toMatchObject({ reason: "org_not_found" });
    stubFetch(410);
    await expect(lookupOrganisation(BRREG, API)).resolves.toMatchObject({ reason: "org_not_active" });
    stubFetch(200, { organisasjonsnummer: BRREG, navn: "X AS", konkurs: true });
    await expect(lookupOrganisation(BRREG, API)).resolves.toMatchObject({ reason: "org_not_active" });
    stubFetch(200, { organisasjonsnummer: BRREG, navn: "X AS", underAvvikling: true });
    await expect(lookupOrganisation(BRREG, API)).resolves.toMatchObject({ reason: "org_not_active" });
    stubFetch(503);
    await expect(lookupOrganisation(BRREG, API)).resolves.toMatchObject({ reason: "brreg_unavailable" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network");
      }),
    );
    await expect(lookupOrganisation(BRREG, API)).resolves.toMatchObject({ reason: "brreg_unavailable" });
  });

  it("never calls the register for an invalid number", async () => {
    const fetch = stubFetch(200, {});
    await expect(lookupOrganisation("974760674", API)).resolves.toMatchObject({ reason: "org_number_invalid" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
