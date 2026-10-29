// `init --light-only`: the example as a site without dark mode — one scheme
// in the profile, the colours single values under `color-scheme: light`, no
// theme script, no theme toggle, and the standard and the component
// catalogue without their dark-mode passages.
//
// Every edit is anchored on what stays put whatever else changes around it:
// in the code, the theme machinery's own names (the profile's `schemes`,
// `THEME_SCRIPT`, `suppressHydrationWarning`, `colorScheme`, `light-dark()`,
// `data-theme`, `ThemeToggle`, the chrome's `themeToggle` labels) and the
// comment written directly above them;
// in the Markdown, the markers around each dark-mode passage —
// `<!-- dark-mode:start -->` … `<!-- dark-mode:end -->`, anywhere in a line
// or across lines, removed with what they hold, and `<!-- light-only: … -->`,
// the text a light-only site reads in its place. An edit that finds nothing
// to change, or a theme name left behind once every edit has run, throws:
// a kit change that moves one fails `init --light-only` (and its test) rather
// than writing a site with a dark line in it.

export class LightOnlyError extends Error {}

/** The example's files a light-only site does not get. */
export const LIGHT_ONLY_DROPS = ["src/components/ui/ThemeToggle.tsx"];

/** The names of the theme machinery: none is left in a file --light-only writes. */
const LEFTOVERS = ["ThemeToggle", "themeToggle", "THEME_SCRIPT", "data-theme", "light-dark(", "dark-mode:start", "dark-mode:end"];

/** The Markdown files that hold dark-mode passages, so must carry markers. */
const MARKED = ["STANDARD.md", "src/components/README.md"];

// A comment written directly above a line (no blank line between): a run of // lines, or one /* … */ block.
const COMMENT_ABOVE = String.raw`(?:(?:^[ \t]*\/\/[^\n]*\n)+|^[ \t]*\/\*(?:(?!\*\/)[\s\S])*\*\/\n)?`;

/** An edit: `pattern` replaced by `by` (a string or a function), which must match at least once; `what` names it in the error. */
const edit = (what, pattern, by) => ({ what, pattern, by });

/** The edits of each file, in order. */
const EDITS = {
  "src/config/harness.ts": [
    edit("the profile's schemes", /^([ \t]*)schemes: \[[^\]]*\]/m, '$1schemes: ["light"]'),
  ],
  "src/config/site.ts": [
    edit("the theme toggle's labels in the chrome's words and the comment above them", new RegExp(`${COMMENT_ABOVE}^[ \\t]*themeToggle: \\{[^}]*\\},\\n`, "m"), ""),
    edit("the theme toggle's labels in the type of the chrome's words", /^[ \t]*themeToggle: \{[^}]*\};\n/m, ""),
  ],
  "src/components/ui/SiteLayout.tsx": [
    edit("the theme script and the comment above it", new RegExp(`${COMMENT_ABOVE}^const THEME_SCRIPT\\b[^\\n]*\\n\\n?`, "m"), ""),
    edit("the theme script's tag", /^[^\n]*\bTHEME_SCRIPT\b[^\n]*\n/gm, ""),
    edit("suppressHydrationWarning on <html>", / suppressHydrationWarning\b/g, ""),
  ],
  "src/app/layout.tsx": [
    edit("the viewport's colorScheme", /colorScheme: "light dark"/, 'colorScheme: "light"'),
  ],
  "src/styles/base.css": [
    edit("color-scheme on :root, its data-theme overrides and the comment above them", new RegExp(`${COMMENT_ABOVE}^:root \\{ color-scheme: light dark; \\}\\n(?::root\\[data-theme="[a-z]+"\\][^\\n]*\\n)*`, "m"), "/* One scheme, light: every colour in globals.css is a single value. */\n:root { color-scheme: light; }\n"),
  ],
  "src/app/globals.css": [
    edit("the comment above the light-dark() pairs", new RegExp(`^[ \\t]*\\/\\*(?:(?!\\*\\/)[\\s\\S])*\\*\\/\\n(?=[ \\t]*--color-[\\w-]+: light-dark\\()`, "m"), ""),
    edit("the light-dark() pairs", /light-dark\(\s*([^,()]+?)\s*,\s*[^()]+?\s*\)/g, "$1"),
  ],
};

/** Runs one edit; throws when it finds nothing. */
function apply(text, file, { what, pattern, by }) {
  pattern.lastIndex = 0;
  if (!pattern.test(text)) throw new LightOnlyError(`${file}: ${what} not found — --light-only cannot make this file light-only (the kit's example changed; report it)`);
  pattern.lastIndex = 0;
  return text.replace(pattern, by);
}

/** A component that uses the toggle, without it: its import and its element, each on a line of its own; an element the toggle was the only child of (the layout's Navbar) closes itself. */
function withoutToggle(text, file) {
  const edits = [edit("ThemeToggle's import", /^import \{ ThemeToggle \} from "[^"]+";\n/m, ""), edit("the <ThemeToggle /> element", /^[ \t]*<ThemeToggle\b[^>]*\/>\n/gm, "")];
  return edits.reduce((out, e) => apply(out, file, e), text).replace(/(<([A-Z]\w*)\b[^<>]*?)>\n[ \t]*<\/\2>/g, "$1 />");
}

/** A Markdown file's dark-mode passages removed and its light-only text put in their place. */
export function markdownLightOnly(text, file) {
  if (text.includes("dark-mode:start") !== text.includes("dark-mode:end")) throw new LightOnlyError(`${file}: a dark-mode:start without its dark-mode:end, or the reverse`);
  if (MARKED.includes(file) && !text.includes("<!-- dark-mode:start -->")) throw new LightOnlyError(`${file}: no <!-- dark-mode:start --> marker — --light-only cannot find its dark-mode passages (report it)`);
  return text
    // markers on lines of their own: those lines go with the passage
    .replace(/^<!-- dark-mode:start -->\n[\s\S]*?^<!-- dark-mode:end -->\n/gm, "")
    // inside a line, or from the end of one line to the end of another (a list item, a table row): the line breaks stay
    .replace(/<!-- dark-mode:start -->[\s\S]*?<!-- dark-mode:end -->/g, "")
    .replace(/<!-- light-only: ([\s\S]*?) -->/g, "$1");
}

/**
 * One file of the example as a light-only site has it: its text edited, null for a file it does not get, or
 * unchanged. Throws a LightOnlyError naming the file and the edit when an anchor is missing or a theme name is
 * left.
 */
export function lightOnlyFile(file, text) {
  if (LIGHT_ONLY_DROPS.includes(file)) return null;
  let out = text;
  for (const e of EDITS[file] ?? []) out = apply(out, file, e);
  if (/\.(tsx?|jsx?)$/.test(file) && out.includes("ThemeToggle")) out = withoutToggle(out, file);
  if (file.endsWith(".md")) out = markdownLightOnly(out, file);
  const left = LEFTOVERS.find((name) => out.includes(name));
  if (left) throw new LightOnlyError(`${file}: ${left} is still there after the light-only edits — mark the passage (<!-- dark-mode:start --> … <!-- dark-mode:end -->) or extend scripts/lib/light-only.mjs`);
  return out;
}

/** Whether --light-only reads a file as text: what it edits and what it checks. */
export const editsText = (file) => /\.(tsx?|jsx?|css|md|mdx)$/.test(file);
