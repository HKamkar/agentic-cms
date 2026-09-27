import type { FormSink } from "../sink.ts";
import type { FormSubmission } from "../submission.ts";

/**
 * Prints each submission to the server's log: for development, where no
 * destination is configured. Not for production — a log is no place to keep
 * what people write to a site.
 */
export class LogSink implements FormSink {
  async deliver(submission: FormSubmission): Promise<void> {
    console.info(`[forms] ${submission.form.id} ${submission.id}\n${JSON.stringify(submission, null, 2)}`);
  }
}
