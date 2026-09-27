import type { SelectField } from "agentic-cms/forms";
import { Icon } from "agentic-cms/components";
import { cx } from "agentic-cms/cx";
import { control } from "./field";
import { FieldWrap } from "./FieldWrap";
import { describedBy } from "./Hint";

/**
 * A single choice from a list. The placeholder is an empty first option, so
 * `required` means a real choice; while it is chosen the text is muted like
 * a text control's placeholder. The browser's arrow is replaced by a drawn
 * chevron, which clicks pass through.
 */
export function Select({ id, field, marker }: { id: string; field: SelectField; marker?: string }) {
  return (
    <FieldWrap id={id} label={field.label} hint={field.hint} marker={marker}>
      <div className="relative">
        <select
          className={cx(control, "h-10 appearance-none pr-10 has-[option[value='']:checked]:text-muted")}
          id={id}
          name={field.name}
          autoComplete={field.autocomplete}
          defaultValue={field.defaultValue ?? (field.placeholder === undefined ? undefined : "")}
          required={field.required}
          aria-describedby={describedBy(id, field.hint)}
        >
          {field.placeholder !== undefined && <option value="">{field.placeholder}</option>}
          {field.options.map((option) => (
            <option key={option.value} value={option.value} className="text-ink">
              {option.label}
            </option>
          ))}
        </select>
        <Icon kind="stroke" d="m6 9 6 6 6-6" size={16} strokeWidth={2} className="pointer-events-none absolute inset-y-0 right-3 my-auto" />
      </div>
    </FieldWrap>
  );
}
