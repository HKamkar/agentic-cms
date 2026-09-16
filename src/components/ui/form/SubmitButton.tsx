import { buttonClass } from "../Button";

/** The form's submit: a real button, disabled while the submission is in flight. */
export function SubmitButton({ label, waitLabel, submitting }: { label: string; waitLabel: string; submitting: boolean }) {
  return (
    <div className="flex flex-col items-start">
      <button type="submit" disabled={submitting} className={buttonClass("solid")}>
        {submitting ? waitLabel : label}
      </button>
    </div>
  );
}
