import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import nb from "../../messages/nb.json";

type Tree = { [k: string]: string | Tree };

function keys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]!).sort();
}

function get(tree: Tree, key: string): string {
  return key.split(".").reduce<string | Tree>((t, k) => (t as Tree)[k]!, tree) as string;
}

describe("messages (P01-03)", () => {
  it("nb and en have exactly the same keys", () => {
    expect(keys(en as Tree).sort()).toEqual(keys(nb as Tree).sort());
  });

  it("every translation uses the same placeholders and rich-text tags", () => {
    for (const key of keys(nb as Tree)) {
      const a = get(nb as Tree, key);
      const b = get(en as Tree, key);
      expect(placeholders(b), key).toEqual(placeholders(a));
      expect([...b.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort(), key).toEqual(
        [...a.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort(),
      );
    }
  });

  it("no message is empty, and the brand is always spelled «Laandet»", () => {
    for (const [name, tree] of [
      ["nb", nb],
      ["en", en],
    ] as const) {
      for (const key of keys(tree as Tree)) {
        const text = get(tree as Tree, key);
        expect(text.trim(), `${name}:${key}`).not.toBe("");
        expect(text, `${name}:${key}`).not.toMatch(/Låndet|Laandit|LaanDet/);
      }
    }
  });
});
