import { describe, expect, it } from "vitest";
import { cleanPagePath } from "./page-path";

describe("cleanPagePath (P04-01)", () => {
  it("keeps a same-site path and drops the query, the fragment and anything that is not a path", () => {
    expect(cleanPagePath("/utforsk")).toBe("/utforsk");
    expect(cleanPagePath("/nytt-passord?token=abc#x")).toBe("/nytt-passord");
    expect(cleanPagePath("https://evil.example/x")).toBeNull();
    expect(cleanPagePath("javascript:alert(1)")).toBeNull();
    expect(cleanPagePath("/<script>")).toBeNull();
    expect(cleanPagePath(undefined)).toBeNull();
  });
});
