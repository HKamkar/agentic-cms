"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { cx } from "agentic-cms/cx";
import { createFormBackend, fieldId, isGroup, isNote, isRow, prefillFromQuery, readFormValues, TRAP_FIELD, type FieldDefinition, type FormDefinition, type FormItem, type SubmitContext } from "agentic-cms/forms";
import { Checkbox } from "./Checkbox";
import { CheckboxGroup } from "./CheckboxGroup";
import { DateField } from "./DateField";
import { FieldGroup } from "./FieldGroup";
import { FieldRow } from "./FieldRow";
import { FormNote } from "./FormNote";
import { FormShell, type FormState } from "./FormShell";
import { NumberField } from "./NumberField";
import { RadioGroup } from "./RadioGroup";
import { Select } from "./Select";
import { SubmitButton } from "./SubmitButton";
import { TextArea } from "./TextArea";
import { TextField } from "./TextField";

/**
 * The form engine: renders a FormDefinition with the field primitives in
 * this folder, validates natively (the controls' own attributes), reads the
 * values with the kit's readFormValues() and hands them to the backend the
 * definition names.
 */
export function Form({ definition }: { definition: FormDefinition }) {
  const [state, setState] = useState<FormState>("idle");
  const backend = useMemo(() => createFormBackend(definition.backend), [definition.backend]);
  const shownAt = useShownAt();
  const formRef = usePrefill(definition);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    const data = new FormData(event.currentTarget);
    const result = await backend.submit(definition, readFormValues(definition, data), readContext(data, shownAt.current)).catch(() => ({ ok: false }));
    setState(result.ok ? "done" : "fail");
  }

  return (
    <FormShell state={state} messages={definition.messages}>
      <form
        ref={formRef}
        id={definition.id}
        name={definition.id}
        className={cx("flex flex-col gap-6", state === "done" && "hidden")}
        method="post"
        onSubmit={onSubmit}
        aria-label={definition.name}
      >
        <Items form={definition} items={definition.items} marker={definition.optionalMarker} />
        {definition.backend.kind === "endpoint" && <Trap />}
        <SubmitButton label={definition.submit.label} waitLabel={definition.submit.waitLabel} submitting={state === "submitting"} />
      </form>
    </FormShell>
  );
}

/** The items in order — fields, rows, notes and groups — with the form's optional marker, unless a group's legend already says it. */
function Items({ form, items, marker }: { form: FormDefinition; items: FormItem[]; marker?: string }) {
  return items.map((item, i) => {
    if (isRow(item))
      return (
        <FieldRow key={i} align={item.row.some((field) => field.type !== "hidden" && Boolean(field.hint))}>
          {item.row.map((field) => (
            <Field key={field.name} form={form} field={field} marker={marker} />
          ))}
        </FieldRow>
      );
    if (isNote(item)) return <FormNote key={i} note={item} />;
    if (isGroup(item))
      return (
        <FieldGroup key={i} legend={item.group}>
          <Items form={form} items={item.items} marker={item.optionalMarker === false ? undefined : marker} />
        </FieldGroup>
      );
    return <Field key={item.name} form={form} field={item} marker={marker} />;
  });
}

/** One component per field type; a new type is a new entry here. The marker goes to the fields that are not required. */
function Field({ form, field, marker }: { form: FormDefinition; field: FieldDefinition; marker?: string }) {
  const id = fieldId(form, field);
  const optional = field.type === "hidden" || field.required ? undefined : marker;
  switch (field.type) {
    case "text":
    case "email":
    case "tel":
    case "url":
      return <TextField id={id} field={field} marker={optional} />;
    case "number":
      return <NumberField id={id} field={field} marker={optional} />;
    case "date":
      return <DateField id={id} field={field} marker={optional} />;
    case "textarea":
      return <TextArea id={id} field={field} marker={optional} />;
    case "select":
      return <Select id={id} field={field} marker={optional} />;
    case "radios":
      return <RadioGroup id={id} field={field} marker={optional} />;
    case "checkboxes":
      return <CheckboxGroup id={id} field={field} marker={optional} />;
    case "checkbox":
      return <Checkbox id={id} field={field} marker={optional} />;
    case "hidden":
      // Nothing to see or style; the server keeps the definition's value whatever this sends.
      return <input type="hidden" name={field.name} value={field.value} />;
  }
}

/**
 * The endpoint's honeypot (agentic-cms/forms TRAP_FIELD): out of sight, out
 * of the tab order and out of the accessibility tree, so only a bot fills it.
 * Absolutely placed, so the form's gaps do not change.
 */
function Trap() {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] size-px overflow-hidden">
      <input type="text" name={TRAP_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

/** After hydration, the fields that name a search parameter take its value (prefillFromQuery): the prerendered page never reads the URL. */
function usePrefill(definition: FormDefinition) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (form.current) prefillFromQuery(form.current, definition, window.location.search);
  }, [definition]);
  return form;
}

/** When the form appeared, for the endpoint's time-to-submit check: set after mount, so the prerendered page holds no clock. */
function useShownAt() {
  const shownAt = useRef<number | undefined>(undefined);
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);
  return shownAt;
}

function readContext(data: FormData, shownAt: number | undefined): SubmitContext {
  const trap = data.get(TRAP_FIELD);
  return { trap: typeof trap === "string" ? trap : undefined, elapsedMs: shownAt === undefined ? undefined : Math.round(performance.now() - shownAt) };
}
