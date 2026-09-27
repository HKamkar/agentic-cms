"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { cx } from "agentic-cms/cx";
import { createFormBackend, fieldId, fieldsOf, isRow, TRAP_FIELD, type FieldDefinition, type FormDefinition, type FormValues, type SubmitContext } from "agentic-cms/forms";
import { CheckboxGroup } from "./CheckboxGroup";
import { FieldRow } from "./FieldRow";
import { FormShell, type FormState } from "./FormShell";
import { SubmitButton } from "./SubmitButton";
import { TextArea } from "./TextArea";
import { TextField } from "./TextField";

/**
 * The form engine: renders a FormDefinition with the field primitives in
 * this folder, validates natively (required / email) and hands the values to
 * the backend the definition names.
 */
export function Form({ definition }: { definition: FormDefinition }) {
  const [state, setState] = useState<FormState>("idle");
  const backend = useMemo(() => createFormBackend(definition.backend), [definition.backend]);
  const shownAt = useShownAt();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    const data = new FormData(event.currentTarget);
    const result = await backend.submit(definition, readValues(definition, data), readContext(data, shownAt.current)).catch(() => ({ ok: false }));
    setState(result.ok ? "done" : "fail");
  }

  return (
    <FormShell state={state} messages={definition.messages}>
      <form
        id={definition.id}
        name={definition.id}
        className={cx("flex flex-col gap-6", state === "done" && "hidden")}
        method="post"
        onSubmit={onSubmit}
        aria-label={definition.name}
      >
        {definition.items.map((item, i) =>
          isRow(item) ? (
            <FieldRow key={i}>
              {item.row.map((field) => (
                <Field key={field.name} form={definition} field={field} />
              ))}
            </FieldRow>
          ) : (
            <Field key={item.name} form={definition} field={item} />
          ),
        )}
        {definition.backend.kind === "endpoint" && <Trap />}
        <SubmitButton label={definition.submit.label} waitLabel={definition.submit.waitLabel} submitting={state === "submitting"} />
      </form>
    </FormShell>
  );
}

/** One component per field type; a new type is a new entry here. */
function Field({ form, field }: { form: FormDefinition; field: FieldDefinition }) {
  const id = fieldId(form, field);
  switch (field.type) {
    case "text":
    case "email":
    case "tel":
      return <TextField id={id} field={field} />;
    case "textarea":
      return <TextArea id={id} field={field} />;
    case "checkboxes":
      return <CheckboxGroup id={id} field={field} />;
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

/** FormData → values by field; checkbox groups always read as arrays. */
function readValues(form: FormDefinition, data: FormData): FormValues {
  const values: FormValues = {};
  for (const field of fieldsOf(form)) {
    const all = data.getAll(field.name).filter((value): value is string => typeof value === "string");
    values[field.name] = field.type === "checkboxes" ? all : (all[0] ?? "");
  }
  return values;
}
