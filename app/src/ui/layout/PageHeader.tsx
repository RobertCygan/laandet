import type { ReactNode } from "react";

export function PageHeader({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="text-[clamp(28px,4vw,42px)] leading-tight tracking-tight">{title}</h1>
      {lead && <p className="mt-3 max-w-2xl text-base text-muted">{lead}</p>}
      {children}
    </header>
  );
}

/** Narrow single-column page for forms (auth, account). */
export function NarrowPage({ children }: { children: ReactNode }) {
  return <div className="wrap max-w-xl py-10">{children}</div>;
}
