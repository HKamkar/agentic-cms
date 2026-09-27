// The form engine's public surface: the definition types a site's
// src/config/forms.ts satisfies, the helpers over a definition, the backend
// factory the <Form> component calls and the helpers it reads, prefills and
// words its messages with. It ships to the browser; the server half (the
// route's handler, the sinks) is agentic-cms/forms/server. The contract is
// README.md.
export { createFormBackend, type FormBackend, type SubmitContext, type SubmitResult } from "./backend.ts";
export { mailtoBody } from "./backends/mailto.ts";
export { EMAIL_SLOT, messageParts, resolveRecipient, withEmailToken } from "./email-token.ts";
export { acceptValue } from "./rules.ts";
export { fieldId, fieldLabel, fieldsOf, isGroup, isNote, isRow, TRAP_FIELD, type Autocomplete, type CheckboxField, type CheckboxGroupField, type DateField, type EndpointPayload, type FieldDefinition, type FieldOption, type FormBackendConfig, type FormDefinition, type FormGroup, type FormItem, type FormLink, type FormNote, type FormRow, type FormValues, type HiddenField, type InputMode, type NumberField, type RadioGroupField, type SelectField, type TextAreaField, type TextField } from "./types.ts";
export { applyValues, prefillFromQuery, queryValues, readFormValues } from "./values.ts";
