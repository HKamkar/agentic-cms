"use client";

import { useMemo, useState, type FormEvent } from "react";
import { cx } from "agentic-cms/cx";
import { createFormBackend, fieldId, fieldsOf, isRow, type FieldDefinition, type FormDefinition, type FormValues } from "agentic-cms/forms";
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    const result = await backend.submit(definition, readValues(definition, new FormData(event.currentTarget)));
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

/** FormData → values by field; checkbox groups always read as arrays. */
function readValues(form: FormDefinition, data: FormData): FormValues {
  const values: FormValues = {};
  for (const field of fieldsOf(form)) {
    const all = data.getAll(field.name).filter((value): value is string => typeof value === "string");
    values[field.name] = field.type === "checkboxes" ? all : (all[0] ?? "");
  }
  return values;
}
