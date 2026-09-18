import type { ReactNode } from "react";
import { cx } from "agentic-cms/cx";

export type FormState = "idle" | "submitting" | "done" | "fail";

/**
 * The form plus its success and error messages: on success the done block
 * replaces the form (which hides itself); on failure the fail block appears
 * under the form.
 */
export function FormShell({ state, messages, children }: { state: FormState; messages: { success: string; error: string }; children: ReactNode }) {
  return (
    <div>
      {children}
      <div className={cx("border border-ink bg-fill p-4", state === "done" ? "block" : "hidden")} role="status">
        {messages.success}
      </div>
      <div className={cx("mt-2 border border-ink p-4", state === "fail" ? "block" : "hidden")} role="alert">
        {messages.error}
      </div>
    </div>
  );
}
