import type { CheckboxGroupField } from "agentic-cms/forms";
import { Choice } from "./Choice";
import { describedBy, Hint } from "./Hint";
import { Marker } from "./Marker";

/** A titled group of checkboxes, flowing onto as many rows as the width needs. */
export function CheckboxGroup({ id, field, marker }: { id: string; field: CheckboxGroupField; marker?: string }) {
  const titleId = `${id}-title`;
  return (
    <div className="flex flex-col gap-3" role="group" aria-labelledby={titleId} aria-describedby={describedBy(id, field.hint)}>
      <p id={titleId} className="font-medium">
        {field.label}
        <Marker text={marker} />
      </p>
      <Hint id={id} text={field.hint} />
      <div className="flex flex-wrap gap-4">
        {field.options.map((option, i) => (
          <Choice key={option.value} type="checkbox" id={`${id}-${i}`} name={field.name} value={option.value} label={option.label} checked={field.defaultValue?.includes(option.value)} />
        ))}
      </div>
    </div>
  );
}
