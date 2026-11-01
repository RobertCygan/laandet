import { CircleAlert, Info, TriangleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

const ICON = { info: Info, warning: TriangleAlert, danger: CircleAlert, success: CircleCheck } as const;

export function Notice({
  tone = "info",
  children,
  role,
}: {
  tone?: keyof typeof ICON;
  children: ReactNode;
  role?: "alert" | "status";
}) {
  const Icon = ICON[tone];
  return (
    <div className={`notice notice-${tone}`} role={role}>
      <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
