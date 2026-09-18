import type { TextField as TextFieldDefinition } from "agentic-cms/forms";
import { cx } from "agentic-cms/cx";
import { control } from "./field";
import { FieldWrap } from "./FieldWrap";

export function TextField({ id, field }: { id: string; field: TextFieldDefinition }) {
  return (
    <FieldWrap id={id} label={field.label}>
      <input className={cx(control, "h-10")} id={id} name={field.name} type={field.type} placeholder={field.placeholder} maxLength={field.maxLength} required={field.required} />
    </FieldWrap>
  );
}
