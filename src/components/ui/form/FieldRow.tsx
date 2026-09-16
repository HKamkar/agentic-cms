import type { ReactNode } from "react";

/** Two fields side by side; they stack on phones. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-4 max-sm:flex-wrap">{children}</div>;
}
