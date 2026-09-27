// The form engine's public surface: the definition types a site's
// src/config/forms.ts satisfies, the helpers over a definition, and the
// backend factory the <Form> component calls. It ships to the browser; the
// server half (the route's handler, the sinks) is agentic-cms/forms/server.
// The contract is README.md.
export { createFormBackend, type FormBackend, type SubmitContext, type SubmitResult } from "./backend.ts";
export { resolveRecipient, withEmailToken } from "./email-token.ts";
export { fieldId, fieldsOf, isRow, TRAP_FIELD, type CheckboxGroupField, type EndpointPayload, type FieldDefinition, type FormBackendConfig, type FormDefinition, type FormItem, type FormRow, type FormValues, type TextAreaField, type TextField } from "./types.ts";
