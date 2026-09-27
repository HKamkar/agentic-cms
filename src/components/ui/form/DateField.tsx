import type { DateField as DateFieldDefinition } from "agentic-cms/forms";
import { cx } from "agentic-cms/cx";
import { control } from "./field";
import { FieldWrap } from "./FieldWrap";
import { describedBy } from "./Hint";

/** The browser's own date picker; the value is YYYY-MM-DD whatever the reader's locale shows. */
export function DateField({ id, field, marker }: { id: string; field: DateFieldDefinition; marker?: string }) {
  return (
    <FieldWrap id={id} label={field.label} hint={field.hint} marker={marker}>
      <input
        className={cx(control, "h-10")}
        id={id}
        name={field.name}
        type="date"
        min={field.min}
        max={field.max}
        autoComplete={field.autocomplete}
        defaultValue={field.defaultValue}
        required={field.required}
        aria-describedby={describedBy(id, field.hint)}
      />
    </FieldWrap>
  );
}
