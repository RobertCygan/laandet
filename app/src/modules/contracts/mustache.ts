/**
 * A minimal, logic-less Mustache renderer for the agreement templates (RENTAL_AGREEMENTS §2):
 * `{{a.b}}` values, `{{#x}}…{{/x}}` sections (arrays repeat with `{{.}}`, truthy values show),
 * `{{^x}}…{{/x}}` inverted sections. Every value goes through `escape` (Markdown escaping), so user
 * text can never add Markdown or HTML. Unknown tags render as nothing; `tagsOf` lets a test check
 * that every tag in a template exists in the view.
 */
type Ctx = unknown;

function lookup(stack: Ctx[], path: string): unknown {
  if (path === ".") return stack[stack.length - 1];
  const [head, ...rest] = path.split(".");
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i];
    if (frame && typeof frame === "object" && head! in (frame as Record<string, unknown>)) {
      let v: unknown = (frame as Record<string, unknown>)[head!];
      for (const k of rest) v = v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined;
      return v;
    }
  }
  return undefined;
}

const truthy = (v: unknown) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

/** Finds the matching `{{/name}}` for a section opened at `from`, honouring nesting of the same name. */
function findClose(tpl: string, name: string, from: number): number {
  const open = new RegExp(
    `\\{\\{[#^]${name.replace(/\./g, "\\.")}\\}\\}|\\{\\{/${name.replace(/\./g, "\\.")}\\}\\}`,
    "g",
  );
  open.lastIndex = from;
  let depth = 1;
  for (let m = open.exec(tpl); m; m = open.exec(tpl)) {
    depth += m[0].startsWith("{{/") ? -1 : 1;
    if (depth === 0) return m.index;
  }
  throw new Error(`unclosed section ${name}`);
}

function renderPart(tpl: string, stack: Ctx[], escape: (s: string) => string): string {
  let out = "";
  let i = 0;
  const tag = /\{\{([#^/]?)\s*([\w.]+|\.)\s*\}\}/g;
  while (i < tpl.length) {
    tag.lastIndex = i;
    const m = tag.exec(tpl);
    if (!m) {
      out += tpl.slice(i);
      break;
    }
    out += tpl.slice(i, m.index);
    const [whole, kind, name] = m as unknown as [string, string, string];
    const after = m.index + whole.length;
    if (kind === "#" || kind === "^") {
      const close = findClose(tpl, name, after);
      const inner = tpl.slice(after, close);
      const value = lookup(stack, name);
      if (kind === "^") {
        if (!truthy(value)) out += renderPart(inner, stack, escape);
      } else if (Array.isArray(value)) {
        for (const item of value) out += renderPart(inner, [...stack, item], escape);
      } else if (truthy(value)) {
        out += renderPart(inner, typeof value === "object" ? [...stack, value] : stack, escape);
      }
      i = close + `{{/${name}}}`.length;
    } else if (kind === "/") {
      throw new Error(`unexpected closing tag ${name}`);
    } else {
      const value = lookup(stack, name);
      out += value === undefined || value === null || value === false ? "" : escape(String(value));
      i = after;
    }
  }
  return out;
}

export function renderMustache(template: string, view: Record<string, unknown>, escape: (s: string) => string): string {
  return renderPart(template, [view], escape);
}

/** Every value tag and section name used in a template (for the "all tags exist" test). */
export function tagsOf(template: string): string[] {
  return [...new Set([...template.matchAll(/\{\{[#^/]?\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]!))];
}

/**
 * Markdown escaping for values placed inside a line: newlines become spaces (so a value can never
 * start a heading, list or table row), and every inline-syntax character is escaped (emphasis,
 * code, links, images, HTML, tables, strikethrough). `-` and `.` stay readable in numbers and dates.
 */
export function escapeMarkdown(value: string): string {
  return value
    .replace(/\r?\n+/g, " ")
    .replace(/[\\`*_{}[\]()#+!|<>~]/g, "\\$&")
    .trim();
}
