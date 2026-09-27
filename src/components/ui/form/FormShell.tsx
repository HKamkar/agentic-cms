import type { ReactNode } from "react";
import { EmailLink } from "agentic-cms/components";
import { cx } from "agentic-cms/cx";
import { messageParts, type FormDefinition } from "agentic-cms/forms";

export type FormState = "idle" | "submitting" | "done" | "fail";

/**
 * The form plus its success and error messages: on success the done block
 * replaces the form (which hides itself); on failure the fail block appears
 * under the form.
 */
export function FormShell({ state, messages, children }: { state: FormState; messages: FormDefinition["messages"]; children: ReactNode }) {
  return (
    <div>
      {children}
      <div className={cx("border border-ink bg-fill p-4", state === "done" ? "block" : "hidden")} role="status">
        <Message text={messages.success} email={messages.email} />
      </div>
      <div className={cx("mt-2 border border-ink p-4", state === "fail" ? "block" : "hidden")} role="alert">
        <Message text={messages.error} email={messages.email} />
      </div>
    </div>
  );
}

/** A message whose `{email}` is a link to the address, which crosses to the browser as a token (withEmailToken) and never as text. */
function Message({ text, email }: { text: string; email?: string }) {
  return messageParts(text, email).map((part, i) => (typeof part === "string" ? part : <EmailLink key={i} token={part.token} />));
}
