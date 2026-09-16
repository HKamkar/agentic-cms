// Forms are data: a FormDefinition (see src/config/forms.ts) says which fields
// exist and where submissions go. The engine in src/components/ui/form renders
// it and createFormBackend() in ./backend.ts sends it.

type FieldBase = {
  /** Key the value is submitted under. */
  name: string;
  label: string;
  required?: boolean;
};

export type TextField = FieldBase & { type: "text" | "email" | "tel"; placeholder?: string; maxLength?: number };
export type TextAreaField = FieldBase & { type: "textarea"; placeholder?: string; maxLength?: number };
export type CheckboxGroupField = FieldBase & { type: "checkboxes"; options: { value: string; label: string }[] };

export type FieldDefinition = TextField | TextAreaField | CheckboxGroupField;

/** Fields in a row sit side by side (the design's two-column row). */
export type FormRow = { row: FieldDefinition[] };
export type FormItem = FieldDefinition | FormRow;

/** Where a submission goes. One implementation per `kind` in ./backends. */
export type FormBackendConfig = { kind: "mailto"; to: string; subject?: string };

export type FormDefinition = {
  /** DOM id of the <form>; also prefixes the field ids. */
  id: string;
  /** Shown to the recipient as the submission's name. */
  name: string;
  items: FormItem[];
  submit: { label: string; waitLabel: string };
  messages: { success: string; error: string };
  backend: FormBackendConfig;
};

/** Submitted values keyed by field name; checkbox groups submit an array. */
export type FormValues = Record<string, string | string[]>;

export const isRow = (item: FormItem): item is FormRow => "row" in item;

export const fieldsOf = (form: FormDefinition): FieldDefinition[] => form.items.flatMap((item) => (isRow(item) ? item.row : [item]));

export const fieldId = (form: FormDefinition, field: FieldDefinition) => `${form.id}-${field.name}`;
