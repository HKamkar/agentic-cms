import type { RadioGroupField } from "agentic-cms/forms";
import { Choice } from "./Choice";
import { describedBy, Hint } from "./Hint";
import { Marker } from "./Marker";

/** One choice of a few, all in view: a fieldset whose legend is the question; `required` on every radio makes the group required. */
export function RadioGroup({ id, field, marker }: { id: string; field: RadioGroupField; marker?: string }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3" aria-describedby={describedBy(id, field.hint)}>
      <legend className="mb-3 font-medium">
        {field.label}
        <Marker text={marker} />
      </legend>
      <Hint id={id} text={field.hint} />
      <div className="flex flex-wrap gap-4">
        {field.options.map((option, i) => (
          <Choice key={option.value} type="radio" id={`${id}-${i}`} name={field.name} value={option.value} label={option.label} checked={field.defaultValue === option.value} required={field.required} />
        ))}
      </div>
    </fieldset>
  );
}
