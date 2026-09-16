import type { TextAreaField } from "@/lib/forms/types";
import { cx } from "@/lib/cx";
import { control } from "./field";
import { FieldWrap } from "./FieldWrap";

export function TextArea({ id, field }: { id: string; field: TextAreaField }) {
  return (
    <FieldWrap id={id} label={field.label}>
      <textarea className={cx(control, "min-h-40 resize-y")} id={id} name={field.name} placeholder={field.placeholder} maxLength={field.maxLength} required={field.required}></textarea>
    </FieldWrap>
  );
}
