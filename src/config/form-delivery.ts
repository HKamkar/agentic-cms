import { createFormSink, type FormSink } from "agentic-cms/forms/server";

// Where the site's endpoint forms deliver (docs/forms.md). Read from the
// environment on each request — a Worker's env arrives with the request —
// and never from config a browser can see. FORM_WEBHOOK_URL points at the
// provider, FORM_WEBHOOK_SECRET signs each delivery. Without a URL,
// development prints submissions to the server's log and production answers
// 503, so the form shows its error message instead of pretending. Imported
// by the route alone; src/config/forms.ts must never import it.
export function formSink(): FormSink | undefined {
  const url = process.env.FORM_WEBHOOK_URL;
  if (url) return createFormSink({ kind: "webhook", url, secret: process.env.FORM_WEBHOOK_SECRET || undefined });
  return process.env.NODE_ENV === "production" ? undefined : createFormSink({ kind: "log" });
}
