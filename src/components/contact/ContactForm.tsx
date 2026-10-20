import { withEmailToken } from "agentic-cms/forms";
import type { SectionProps } from "@/components/sections/schemas";
import { Form } from "@/components/ui/form/Form";
import { Section } from "@/components/ui/Section";
import { forms } from "@/config/forms";

/** The contact form; its fields, messages and backend are the definition `form` names in src/config/forms.ts, its address crossing to the browser as a token. */
export function ContactForm({ form }: SectionProps<"contact-form">) {
  return (
    <Section type="contact-form">
      <Form definition={withEmailToken(forms[form as keyof typeof forms])} />
    </Section>
  );
}
