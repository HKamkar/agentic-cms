// The values of a rendered form, read the way the server reads them: a
// site's <Form> calls readFormValues() on submit and prefillFromQuery() once
// it has hydrated, so a new field type is taught here, once, and not in every
// site's copy of Form.tsx.
import { acceptValue } from "./rules.ts";
import { fieldsOf, type FormDefinition, type FormValues } from "./types.ts";

/** FormData → values by field: a checkbox group reads as an array, an unticked box or an unchosen radio as "", a hidden field as its definition's value. */
export function readFormValues(form: FormDefinition, data: FormData): FormValues {
  const values: FormValues = {};
  for (const field of fieldsOf(form)) {
    const all = data.getAll(field.name).filter((value): value is string => typeof value === "string");
    values[field.name] = field.type === "checkboxes" ? all : field.type === "hidden" ? field.value : (all[0] ?? "");
  }
  return values;
}

/** What a URL's search parameters give the fields that name one (`fromQuery`): only a value the field would accept, an option of a select or a radio group. */
export function queryValues(form: FormDefinition, search: string | URLSearchParams): FormValues {
  const params = new URLSearchParams(search);
  const values: FormValues = {};
  for (const field of fieldsOf(form)) {
    if (field.type === "hidden" || !field.fromQuery || !params.has(field.fromQuery)) continue;
    const value = field.type === "checkboxes" ? [...new Set(params.getAll(field.fromQuery).filter((choice) => acceptValue(field, [choice])))] : acceptValue(field, params.get(field.fromQuery));
    if (value !== undefined && value.length > 0) values[field.name] = value;
  }
  return values;
}

/** The part of a form element this module touches, so it runs against a fake in a test. */
type FormControl = { value: string; type?: string; checked?: boolean; tagName?: string };
type ControlOwner = { elements: { namedItem(name: string): unknown } };

/** Sets a rendered form's controls to values: a text control's value, the radio or the boxes that carry it. Properties, not attributes, so a number's step base stays the definition's. */
export function applyValues(form: ControlOwner, values: FormValues): void {
  for (const [name, value] of Object.entries(values)) {
    const chosen = new Set(Array.isArray(value) ? value : [value]);
    for (const control of controlsNamed(form, name)) {
      if (control.type === "checkbox" || control.type === "radio") control.checked = chosen.has(control.value);
      else control.value = Array.isArray(value) ? (value[0] ?? "") : value;
    }
  }
}

/** One control (an element — a select, which is also a list, among them), or each control of a radio group or checkbox group. */
function controlsNamed(form: ControlOwner, name: string): FormControl[] {
  const found = form.elements.namedItem(name) as FormControl | Iterable<FormControl> | null;
  if (!found) return [];
  return "tagName" in found ? [found as FormControl] : [...(found as Iterable<FormControl>)];
}

/** Once the form has hydrated: the fields that name a search parameter take its value from the page's URL. The page stays prerendered — the URL is read in the browser, never on the server. */
export function prefillFromQuery(form: ControlOwner, definition: FormDefinition, search: string): void {
  applyValues(form, queryValues(definition, search));
}
