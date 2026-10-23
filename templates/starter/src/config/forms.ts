import type { FormDefinition } from "agentic-cms/forms";
import { site } from "./site";

// Every form on the site, as data. Render one with <Form definition={forms.x} />
// (src/components/ui/form). Adding a landing-page form means adding an entry
// here, not writing component code; `backend` decides where submissions go.
export const forms = {
  contact: {
    id: "contact",
    name: "Contact form",
    items: [
      {
        row: [
          { type: "text", name: "firstName", label: "First name", placeholder: "Enter your first name", required: true, maxLength: 256 },
          { type: "text", name: "lastName", label: "Last name", placeholder: "Enter your last name", required: true, maxLength: 256 },
        ],
      },
      { type: "email", name: "email", label: "Email address", placeholder: "Email address", required: true, maxLength: 256 },
      {
        type: "textarea",
        name: "message",
        label: "Your message",
        placeholder: "What would you like to ask?",
        required: true,
        maxLength: 5000,
      },
    ],
    submit: { label: "Submit now", waitLabel: "Please wait..." },
    messages: {
      success: `Thank you. Your message has reached ${site.name}; the person who reads that mailbox replies.`,
      // {email} renders the address as a link, a token in the page (withEmailToken, where the form is rendered).
      error: "Something went wrong. Please email us directly at {email}.",
      email: site.email,
    },
    // Opens the visitor's mail client: nothing to run, the recipient a token
    // in the page. To deliver instead, set { kind: "endpoint", url:
    // "/api/forms/contact" } and a destination in the environment
    // (src/config/form-delivery.ts, docs/forms.md).
    backend: { kind: "mailto", to: site.email, subject: "Contact form" },
  },
} satisfies Record<string, FormDefinition>;
