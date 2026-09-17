import type { FormDefinition } from "content-engine-kit/forms";
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
      {
        row: [
          { type: "text", name: "organisation", label: "Organisation", placeholder: "Organisation", required: true, maxLength: 256 },
          { type: "email", name: "email", label: "Email address", placeholder: "Email address", required: true, maxLength: 256 },
        ],
      },
      {
        type: "textarea",
        name: "message",
        label: "Your message",
        placeholder: "What are you building, and what would you like to know?",
        required: true,
        maxLength: 5000,
      },
      {
        type: "checkboxes",
        name: "services",
        label: "Select service",
        options: [
          { value: "A question about the kit", label: "A question about the kit" },
          { value: "Help starting a site", label: "Help starting a site" },
          { value: "Something else", label: "Something else" },
        ],
      },
    ],
    submit: { label: "Submit now", waitLabel: "Please wait..." },
    messages: {
      success: "Thank you. Your message has reached Acme; the person who reads that mailbox replies.",
      error: `Something went wrong. Please email us directly at ${site.email}.`,
    },
    // Until a form service is chosen this opens the visitor's mail client.
    backend: { kind: "mailto", to: site.email, subject: "Contact form" },
  },
} satisfies Record<string, FormDefinition>;
