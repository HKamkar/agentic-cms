// The server half of the form engine, for a site's route
// (src/app/api/forms/[id]/route.ts) and nothing a browser loads: the
// handler, the validation it repeats, the wire format, the sinks and the
// signature a receiver checks. Web APIs only (Request, Response, fetch,
// crypto.subtle), so it runs on Node and on Workers. The contract is
// ../README.md.
export { createFormHandler, type FormHandler, type FormHandlerOptions } from "./handler.ts";
export { clientIp, memoryRateLimiter, type MemoryRateLimiterOptions, type RateLimiter } from "./rate-limit.ts";
export { signFormBody, verifyFormSignature, type SignedRequest } from "./signature.ts";
export { createFormSink, type FormSink, type FormSinkConfig } from "./sink.ts";
export { buildSubmission, type FormSubmission, type SubmittedFrom, type Utm } from "./submission.ts";
export { validateSubmission, type Validation } from "./validate.ts";
