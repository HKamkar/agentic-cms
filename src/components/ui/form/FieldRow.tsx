import { createContext, type ReactNode } from "react";

/** Whether the fields of this row put their control at the bottom, so a hint under one label does not push its control below its neighbour's. */
export const RowAlign = createContext(false);

/** Two fields side by side; they stack on phones. `align` when one of them has a hint. */
export function FieldRow({ align = false, children }: { align?: boolean; children: ReactNode }) {
  return (
    <div className="flex gap-4 max-sm:flex-wrap">
      <RowAlign value={align}>{children}</RowAlign>
    </div>
  );
}
