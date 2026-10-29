// How a part of the package goes (docs/stability.md § How a change is
// announced): for one minor it keeps working and says so once per process,
// naming what replaces it; the next breaking release removes it. No React and
// no Node API, so it runs in the build, a script and the browser alike.

const warned = new Set<string>();

/** Warns once per process that `name` is deprecated: `deprecated("pageMeta()", "pageMetadata()")`. */
export function deprecated(name: string, instead: string, warn: (message: string) => void = console.warn): void {
  if (warned.has(name)) return;
  warned.add(name);
  warn(`agentic-cms: ${name} is deprecated and goes in the next breaking release; use ${instead} (docs/stability.md)`);
}
