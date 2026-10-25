import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { headingId, rewriteLegalHref } from "@/modules/legal/content";

function text(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(text).join("");
  if (children && typeof children === "object" && "props" in children) return text((children as { props: { children?: ReactNode } }).props.children);
  return "";
}

/**
 * Markdown from our own repository (legal texts). Raw HTML is never rendered (skipHtml),
 * links are rewritten to app routes and unsafe targets are dropped.
 */
export function Markdown({ source, locale }: { source: string; locale: "nb" | "en" }) {
  const components: Components = {
    a: ({ href, children }) => {
      const safe = rewriteLegalHref(href, locale);
      if (!safe) return <span>{children}</span>;
      const external = safe.startsWith("https://");
      return (
        <a href={safe} {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
          {children}
        </a>
      );
    },
    h2: ({ children }) => <h2 id={headingId(text(children))}>{children}</h2>,
    h3: ({ children }) => <h3 id={headingId(text(children))}>{children}</h3>,
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table>{children}</table>
      </div>
    ),
  };
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
      {source}
    </ReactMarkdown>
  );
}
