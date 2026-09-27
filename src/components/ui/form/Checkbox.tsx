import type { CheckboxField } from "agentic-cms/forms";
import { describedBy, Hint } from "./Hint";
import { Marker } from "./Marker";

/**
 * One box, for consent or an opt-in. A link at the end of its label opens in
 * a new tab, so what the visitor has typed stays; clicking it does not tick
 * the box (a label ignores clicks on the interactive content inside it).
 */
export function Checkbox({ id, field, marker }: { id: string; field: CheckboxField; marker?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          id={id}
          name={field.name}
          value={field.value}
          defaultChecked={field.defaultChecked}
          required={field.required}
          aria-describedby={describedBy(id, field.hint)}
          className="mt-1 size-4 shrink-0 accent-ink"
        />
        <span>
          {field.label}
          {field.link && (
            <>
              {" "}
              <a href={field.link.href} target="_blank" rel="noopener">
                {field.link.label}
              </a>
            </>
          )}
          <Marker text={marker} />
        </span>
      </label>
      <Hint id={id} text={field.hint} className="pl-6" />
    </div>
  );
}
