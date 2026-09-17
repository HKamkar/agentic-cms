import type { CheckboxGroupField } from "content-engine-kit/forms";

/** A titled group of checkboxes, flowing onto as many rows as the width needs. */
export function CheckboxGroup({ id, field }: { id: string; field: CheckboxGroupField }) {
  const titleId = `${id}-title`;
  return (
    <div className="flex flex-col gap-3" role="group" aria-labelledby={titleId}>
      <p id={titleId} className="font-medium">
        {field.label}
      </p>
      <div className="flex flex-wrap gap-4">
        {field.options.map((option, i) => (
          <Checkbox key={option.value} id={`${id}-${i}`} name={field.name} value={option.value} label={option.label} />
        ))}
      </div>
    </div>
  );
}

/** The browser's own checkbox, tinted to the one ink colour. */
function Checkbox({ id, name, value, label }: { id: string; name: string; value: string; label: string }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" id={id} name={name} value={value} className="size-4 accent-ink" />
      {label}
    </label>
  );
}
