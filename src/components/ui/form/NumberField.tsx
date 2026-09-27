import type { NumberField as NumberFieldDefinition } from "agentic-cms/forms";
import { cx } from "agentic-cms/cx";
import { control } from "./field";
import { FieldWrap } from "./FieldWrap";
import { describedBy } from "./Hint";

/** A number input: the browser checks `min`, `max` and `step` (counted from `min`, else the default value). */
export function NumberField({ id, field, marker }: { id: string; field: NumberFieldDefinition; marker?: string }) {
  return (
    <FieldWrap id={id} label={field.label} hint={field.hint} marker={marker}>
      <input
        className={cx(control, "h-10")}
        id={id}
        name={field.name}
        type="number"
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
        step={field.step}
        autoComplete={field.autocomplete}
        defaultValue={field.defaultValue}
        required={field.required}
        aria-describedby={describedBy(id, field.hint)}
      />
    </FieldWrap>
  );
}
