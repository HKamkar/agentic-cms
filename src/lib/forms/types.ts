// Forms are data: a FormDefinition (see src/config/forms.ts) says which fields
// exist and where submissions go. The engine in src/components/ui/form renders
// it and createFormBackend() in ./backend.ts sends it.

/** A link at the end of a checkbox's label or of a note. */
export type FormLink = { label: string; href: string };

/** One choice of a select, a radio group or a checkbox group: `value` is submitted, `label` is shown and written into a mailto body. */
export type FieldOption = { value: string; label: string };

/** The HTML autofill tokens a contact or landing-page form asks for; credentials and payment are not a form definition's business. */
export type Autocomplete =
  | "on"
  | "off"
  | "name"
  | "honorific-prefix"
  | "given-name"
  | "additional-name"
  | "family-name"
  | "honorific-suffix"
  | "nickname"
  | "email"
  | "tel"
  | "tel-country-code"
  | "tel-national"
  | "tel-area-code"
  | "tel-local"
  | "tel-extension"
  | "organization"
  | "organization-title"
  | "url"
  | "street-address"
  | "address-line1"
  | "address-line2"
  | "address-line3"
  | "address-level1"
  | "address-level2"
  | "address-level3"
  | "address-level4"
  | "postal-code"
  | "country"
  | "country-name"
  | "language"
  | "bday"
  | "bday-day"
  | "bday-month"
  | "bday-year"
  | "sex";

/** The keyboard a touch device shows for a text-like input. */
export type InputMode = "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";

type FieldBase = {
  /** Key the value is submitted under. */
  name: string;
  label: string;
  required?: boolean;
  /** Help text under the label, joined to the control by aria-describedby. */
  hint?: string;
};

/**
 * Where a control's first value comes from: `defaultValue` from the
 * definition, then `fromQuery`, the name of a URL search parameter
 * (`?topic=hosting`), read after hydration and taken only when the field
 * would accept it.
 */
type Prefill<T> = { defaultValue?: T; fromQuery?: string };

export type TextField = FieldBase &
  Prefill<string> & { type: "text" | "email" | "tel" | "url"; placeholder?: string; minLength?: number; maxLength?: number; pattern?: string; inputMode?: InputMode; autocomplete?: Autocomplete };
export type NumberField = FieldBase & Prefill<number> & { type: "number"; placeholder?: string; min?: number; max?: number; step?: number | "any"; autocomplete?: Autocomplete };
/** `min`, `max` and `defaultValue` are YYYY-MM-DD, as the browser submits the value. */
export type DateField = FieldBase & Prefill<string> & { type: "date"; min?: string; max?: string; autocomplete?: Autocomplete };
export type TextAreaField = FieldBase & Prefill<string> & { type: "textarea"; placeholder?: string; rows?: number; minLength?: number; maxLength?: number; autocomplete?: Autocomplete };
/** `placeholder` is an empty first option, so `required` means a real choice; without one the first option is chosen from the start. */
export type SelectField = FieldBase & Prefill<string> & { type: "select"; options: FieldOption[]; placeholder?: string; autocomplete?: Autocomplete };
export type RadioGroupField = FieldBase & Prefill<string> & { type: "radios"; options: FieldOption[] };
export type CheckboxGroupField = FieldBase & Prefill<string[]> & { type: "checkboxes"; options: FieldOption[] };
/** One box, for consent or an opt-in: submits `value` when ticked, "" when not. Its label may end in a link. */
export type CheckboxField = FieldBase & { type: "checkbox"; value: string; link?: FormLink; defaultChecked?: boolean; fromQuery?: string };
/** A fixed value the form carries (a campaign, an offer); the label names it in a mailto body and the wire format, and is never shown. */
export type HiddenField = { type: "hidden"; name: string; label: string; value: string };

export type FieldDefinition = TextField | NumberField | DateField | TextAreaField | SelectField | RadioGroupField | CheckboxGroupField | CheckboxField | HiddenField;

/** Fields in a row sit side by side (the design's two-column row). */
export type FormRow = { row: FieldDefinition[] };
/** A line of text inside the form, with an optional link at its end; it submits nothing. */
export type FormNote = { note: string; link?: FormLink };
/** A fieldset with a legend around other items. `optionalMarker: false` when the legend already says its fields are optional. */
export type FormGroup = { group: string; items: (FieldDefinition | FormRow | FormNote)[]; optionalMarker?: false };
export type FormItem = FieldDefinition | FormRow | FormNote | FormGroup;

/**
 * Where a submission goes. One implementation per `kind` in ./backends:
 * `mailto` opens the visitor's mail client; `endpoint` posts to a route of
 * the site, where agentic-cms/forms/server validates it and hands it to the
 * site's sink (README.md, "The endpoint").
 */
export type FormBackendConfig = { kind: "mailto"; to: string; subject?: string } | { kind: "endpoint"; url: string };

export type FormDefinition = {
  /** DOM id of the <form>; also prefixes the field ids. */
  id: string;
  /** Shown to the recipient as the submission's name. */
  name: string;
  items: FormItem[];
  /** Shown after the label of every field that is not required, e.g. "(optional)": set it when a form mixes required and optional fields. */
  optionalMarker?: string;
  submit: { label: string; waitLabel: string };
  /** `{email}` in either message stands for `email`, rendered as a link; withEmailToken() makes it a token. */
  messages: { success: string; error: string; email?: string };
  backend: FormBackendConfig;
};

/** Submitted values keyed by field name; checkbox groups submit an array. */
export type FormValues = Record<string, string | string[]>;

/** The JSON the endpoint backend posts and agentic-cms/forms/server reads: the values, the two spam signals, where the form was sent from. */
export type EndpointPayload = { values: FormValues; trap?: string; elapsedMs?: number; page?: string; referrer?: string };

/**
 * The name of the honeypot input a site's <Form> renders for an endpoint
 * form: out of sight and out of the tab order, so a person leaves it empty
 * and a naive bot fills it. Meaningless on purpose, so no browser autofills it.
 */
export const TRAP_FIELD = "_hp";

export const isRow = (item: FormItem): item is FormRow => "row" in item;
export const isNote = (item: FormItem): item is FormNote => "note" in item;
export const isGroup = (item: FormItem): item is FormGroup => "group" in item;

/** Every field of the form in its order, out of rows and groups; notes hold none. */
export const fieldsOf = (form: FormDefinition): FieldDefinition[] => fieldsIn(form.items);

const fieldsIn = (items: FormItem[]): FieldDefinition[] => items.flatMap((item) => (isRow(item) ? item.row : isGroup(item) ? fieldsIn(item.items) : isNote(item) ? [] : [item]));

export const fieldId = (form: FormDefinition, field: FieldDefinition) => `${form.id}-${field.name}`;

/** The label as a reader sees it: a checkbox's ends in its link's text. */
export const fieldLabel = (field: FieldDefinition): string => (field.type === "checkbox" && field.link ? `${field.label} ${field.link.label}` : field.label);
