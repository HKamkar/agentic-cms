import type { ReactNode } from "react";

/** A field's label above its control. */
export function FieldWrap({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
