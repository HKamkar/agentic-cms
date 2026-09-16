import type { SectionProps } from "@/components/sections/schemas";
import { Form } from "@/components/ui/form/Form";
import { Section } from "@/components/ui/Section";
import { forms } from "@/config/forms";

/** The contact form; its fields, messages and backend are the definition `form` names in src/config/forms.ts. */
export function ContactForm({ form }: SectionProps<"contact-form">) {
  return (
    <Section type="contact-form">
      <Form definition={forms[form as keyof typeof forms]} />
    </Section>
  );
}
