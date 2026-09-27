import { useContext, type ReactNode } from "react";
import { cx } from "agentic-cms/cx";
import { RowAlign } from "./FieldRow";
import { Hint } from "./Hint";
import { Marker } from "./Marker";

/** A field's label above its control, and its hint between them; in a row where a neighbour has a hint, the control sits at the bottom so the two line up. */
export function FieldWrap({ id, label, hint, marker, children }: { id: string; label: string; hint?: string; marker?: string; children: ReactNode }) {
  const align = useContext(RowAlign);
  return (
    <div className={cx("flex w-full flex-col gap-1.5", align && "justify-between")}>
      <label htmlFor={id}>
        {label}
        <Marker text={marker} />
      </label>
      <Hint id={id} text={hint} />
      {children}
    </div>
  );
}
