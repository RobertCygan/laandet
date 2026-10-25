import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

const render = (source: string) => renderToStaticMarkup(createElement(Markdown, { source, locale: "nb" }));

const MALICIOUS = `# Vilkår

<script>alert("xss")</script>

<img src="x" onerror="alert(1)">

<!-- intern merknad -->

[klikk](javascript:alert(1)) [data](data:text/html;base64,PHNjcmlwdD4=) [ok](personvernerklaering.md)

<a href="https://evil.example" onclick="steal()">lenke</a>
`;

describe("legal Markdown renderer (P01-11 §3)", () => {
  const html = render(MALICIOUS);

  it("never renders raw HTML, event handlers or script", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror|onclick/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toContain("evil.example");
  });

  it("drops javascript: and data: links but keeps internal ones", () => {
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/data:text/i);
    expect(html).toContain('href="/personvern"');
  });

  it("does not render HTML comments", () => {
    expect(html).not.toContain("intern merknad");
  });

  it("gives external https links safe rel attributes", () => {
    expect(render("[Datatilsynet](https://www.datatilsynet.no)")).toContain('rel="noopener noreferrer"');
  });
});
