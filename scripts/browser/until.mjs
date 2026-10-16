// A browser test's wait for what it is about to assert: a loaded runner
// draws a page's frames late, delivers an observer's entries late and lets a
// process go late, so a fixed sleep before an assertion that something
// happened fails on a slow machine alone. A sleep before an assertion that
// nothing happened (a frame held, nothing played again) stays: the span is
// the point there.

/** `get()` again every 50 ms until `ready` holds of what it returned, for at most `ms`; the last value either way, for the assertion after it to judge. */
export async function until(get, ready, ms = 5000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await get();
    if (ready(value) || Date.now() >= end) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
