import assert from "node:assert/strict";
import { test } from "node:test";
import { LightOnlyError, lightOnlyFile, markdownLightOnly } from "./light-only.mjs";

const fails = (fn, pattern) => assert.throws(fn, (error) => error instanceof LightOnlyError && pattern.test(error.message));

test("a Markdown file: a marked passage goes, inside a line, across lines or as whole lines, and its light-only text takes its place", () => {
  const text = [
    "Four values<!-- dark-mode:start -->, each a pair,<!-- dark-mode:end --> and three roles.",
    "",
    "- one<!-- dark-mode:start -->",
    "- the toggle,",
    "  on two lines<!-- dark-mode:end -->",
    "- two",
    "",
    "<!-- dark-mode:start -->",
    "### The theme",
    "",
    "Both modes.",
    "<!-- dark-mode:end -->",
    "<!-- light-only: ### The scheme",
    "",
    "One scheme.",
    " -->",
    "",
    "| A | B |<!-- dark-mode:start -->",
    "| dark | row |<!-- dark-mode:end -->",
    "| C | D |",
  ].join("\n");
  assert.equal(markdownLightOnly(text, "x.md"), ["Four values and three roles.", "", "- one", "- two", "", "### The scheme", "", "One scheme.", "", "", "| A | B |", "| C | D |"].join("\n"));
  fails(() => markdownLightOnly("a <!-- dark-mode:start --> b", "x.md"), /x\.md: a dark-mode:start without its dark-mode:end/);
  fails(() => markdownLightOnly("no markers", "STANDARD.md"), /STANDARD\.md: no <!-- dark-mode:start --> marker/);
});

test("a component that renders the toggle loses its import and its element, wherever they sit and whatever props it takes", () => {
  const navbar = 'import { Button } from "@/components/ui/Button";\nimport { ThemeToggle } from "@/components/ui/ThemeToggle";\n\nexport function Bar() {\n  return (\n    <div>\n      <Button />\n      <ThemeToggle className="x" />\n    </div>\n  );\n}\n';
  assert.equal(lightOnlyFile("src/components/ui/Bar.tsx", navbar), 'import { Button } from "@/components/ui/Button";\n\nexport function Bar() {\n  return (\n    <div>\n      <Button />\n    </div>\n  );\n}\n');
  assert.equal(lightOnlyFile("src/components/ui/ThemeToggle.tsx", "export function ThemeToggle() {}"), null, "the toggle itself is not written");
  fails(() => lightOnlyFile("src/components/ui/Bar.tsx", "const T = ThemeToggle;\n"), /Bar\.tsx: ThemeToggle's import not found/);
  fails(() => lightOnlyFile("src/components/ui/Bar.tsx", 'import { ThemeToggle } from "./ThemeToggle";\nconst T = ThemeToggle;\n'), /Bar\.tsx: the <ThemeToggle \/> element not found/);
});

test("an edit that finds nothing fails loudly, naming the file and the edit; so does a theme name left behind", () => {
  fails(() => lightOnlyFile("src/components/ui/SiteLayout.tsx", "export function SiteLayout() { return null; }\n"), /src\/components\/ui\/SiteLayout\.tsx: the theme script and the comment above it not found/);
  fails(() => lightOnlyFile("src/styles/base.css", ":root { color-scheme: light; }\n"), /src\/styles\/base\.css: color-scheme on :root/);
  fails(() => lightOnlyFile("src/config/harness.ts", "export const harness = { storage: {} };\n"), /src\/config\/harness\.ts: the profile's schemes not found/);
  fails(() => lightOnlyFile("src/components/ui/Card.module.css", ".card { color: light-dark(#000, #fff); }\n"), /Card\.module\.css: light-dark\( is still there/);
  assert.equal(lightOnlyFile("src/components/ui/Card.tsx", "export const Card = () => null;\n"), "export const Card = () => null;\n", "a file with nothing of the theme is left as it is");
});

test("the colours: each light-dark() pair its light value, and the comment written above them gone with it", () => {
  const css = "@theme static {\n  --color-*: initial;\n  /* Each value a light and a dark side. */\n  --color-paper: light-dark(#ffffff, #121212);\n  --color-ink: light-dark( #000 , #f2f2f2 );\n  --color-line: var(--color-ink);\n}\n";
  assert.equal(lightOnlyFile("src/app/globals.css", css), "@theme static {\n  --color-*: initial;\n  --color-paper: #ffffff;\n  --color-ink: #000;\n  --color-line: var(--color-ink);\n}\n");
});
