import { createFormHandler } from "agentic-cms/forms/server";
import { formSink } from "@/config/form-delivery";
import { forms } from "@/config/forms";

// The site's one dynamic route: every page stays prerendered, and a form whose
// backend is `endpoint` posts here. One handler for the process (it holds the
// rate limiter's memory); the sink is read per request, from the environment.
const handle = createFormHandler({ forms, sink: formSink });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(request, id);
}
