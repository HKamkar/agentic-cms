import type { ReactNode } from "react";
import { Hint } from "./Hint";
import { Marker } from "./Marker";

/** A field's label above its control, and its hint between them. */
export function FieldWrap({ id, label, hint, marker, children }: { id: string; label: string; hint?: string; marker?: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id}>
        {label}
        <Marker text={marker} />
      </label>
      <Hint id={id} text={hint} />
      {children}
    </div>
  );
}
