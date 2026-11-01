import { createHash } from "node:crypto";
import { escapeMarkdown, renderMustache } from "./mustache";
import { toContractView, type ContractTerms } from "./terms";

/** Removes front matter and every HTML comment (developer notes) from a template. */
export function templateBody(md: string): string {
  return (
    md
      .replace(/^---\n[\s\S]*?\n---\n/, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim() + "\n"
  );
}

/** Deterministic rendering: the same terms and template always give the same text and hash. */
export function renderContract(
  templateMd: string,
  terms: ContractTerms,
  locale: "nb" | "en",
): { text: string; sha256: string } {
  const text = renderMustache(templateBody(templateMd), toContractView(terms, locale), escapeMarkdown).replace(
    /\n{3,}/g,
    "\n\n",
  );
  return { text, sha256: createHash("sha256").update(text, "utf8").digest("hex") };
}
