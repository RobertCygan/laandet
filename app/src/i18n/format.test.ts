import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatIsoDate,
  formatKr,
  oreToInput,
  osloInputs,
  osloLocalToDate,
  parseKrToOre,
} from "./format";

const NBSP = " ";

describe("formatKr", () => {
  it("formats whole kroner with Norwegian grouping and non-breaking spaces", () => {
    expect(formatKr(0)).toBe(`0${NBSP}kr`);
    expect(formatKr(15000)).toBe(`150${NBSP}kr`);
    expect(formatKr(150000)).toBe(`1${NBSP}500${NBSP}kr`);
  });

  it("shows øre with a comma when not whole kroner", () => {
    expect(formatKr(123456789)).toBe(`1${NBSP}234${NBSP}567,89${NBSP}kr`);
    expect(formatKr(5)).toBe(`0,05${NBSP}kr`);
  });

  it("keeps full precision above 2^53 øre using bigint", () => {
    const big = BigInt("9007199254740993"); // 2^53 + 1
    expect(formatKr(big)).toBe(`90${NBSP}071${NBSP}992${NBSP}547${NBSP}409,93${NBSP}kr`);
  });

  it("rejects non-integer numbers instead of rounding money", () => {
    expect(() => formatKr(10.5)).toThrow(RangeError);
    expect(() => formatKr(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError);
  });
});

describe("parseKrToOre", () => {
  it("parses common inputs", () => {
    expect(parseKrToOre("1500")).toBe(150000);
    expect(parseKrToOre("1 500")).toBe(150000);
    expect(parseKrToOre("1 500 kr")).toBe(150000);
    expect(parseKrToOre("12,5")).toBe(1250);
    expect(parseKrToOre("12.50")).toBe(1250);
  });

  it("rejects invalid amounts", () => {
    for (const bad of ["", "-5", "abc", "1,234", "1e3", "12,345"]) {
      expect(parseKrToOre(bad)).toBeNull();
    }
  });
});

describe("dates (Europe/Oslo)", () => {
  it("formats dates as dd.mm.yyyy", () => {
    expect(formatDate(new Date("2026-12-14T09:00:00Z"))).toBe("14.12.2026");
    // 23:30 UTC on 31 Dec is already 1 Jan in Oslo
    expect(formatDate(new Date("2026-12-31T23:30:00Z"))).toBe("01.01.2027");
  });

  it("formats date and time per locale", () => {
    const d = new Date("2026-12-14T09:00:00Z"); // 10:00 in Oslo (CET)
    expect(formatDateTime(d, "nb")).toBe(`14.12.2026 kl.${NBSP}10:00`);
    expect(formatDateTime(d, "en")).toBe("14.12.2026, 10:00");
  });

  it("reads form date + time as Oslo wall time, winter and summer", () => {
    expect(osloLocalToDate("2026-12-14", "10:00")?.toISOString()).toBe("2026-12-14T09:00:00.000Z");
    expect(osloLocalToDate("2026-07-01", "10:00")?.toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(osloInputs(new Date("2026-07-01T08:00:00Z"))).toEqual({ date: "2026-07-01", time: "10:00" });
    expect(osloLocalToDate("2026-13-01", "10:00")).toBeNull();
    expect(osloLocalToDate("2026-12-14", "24:00")).toBeNull();
    expect(osloLocalToDate("", "")).toBeNull();
  });
});

describe("oreToInput", () => {
  it("round-trips with parseKrToOre", () => {
    for (const ore of [0, 5, 150000, 150050, 99999999]) expect(parseKrToOre(oreToInput(ore))).toBe(ore);
    expect(oreToInput(150000)).toBe("1500");
    expect(oreToInput(null)).toBe("");
  });
});

describe("formatIsoDate", () => {
  it("formats a calendar date without time-zone shifts", () => {
    expect(formatIsoDate("2026-12-14")).toBe("14.12.2026");
  });
});
