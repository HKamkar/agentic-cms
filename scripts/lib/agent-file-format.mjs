// The agent files a site holds since 0.9.0, as text (docs/roadmap.md job 10,
// D15). A site's rule is thin: its `paths`, then the kit's block — the
// rule's title, the blocks the kit marks required and a pointer to the kit's
// whole rule in the installed package — which `init --agent-files` rewrites
// on every run, the site's own lines after it. A Codex stub stands for each
// of the kit's skills: its name and description, and the package's file to
// read; nothing in it is the site's. The kit's skills themselves come from the
// package's plugins, never copied (lib/agent-files.mjs).
import { REQUIRED, requiredSources } from "./agent-required.mjs";

/** The manifest of what `init` wrote into a site, and the format of it this kit writes (0.8's had none, and recorded bases). */
export const MANIFEST = ".agentic-cms.json";
export const FORMAT = 2;
/** The site's Claude Code settings, and the template the kit's keys in it come from. */
export const SETTINGS = ".claude/settings.json";
export const SETTINGS_TEMPLATE = "templates/site/settings.json";
/** The kit's whole rules, a site's thin rule each, and the kit's Codex skills, a stub each. */
export const RULES = "templates/site/rules";
export const SKILLS = ".agents/skills";
const PACKAGE = "node_modules/agentic-cms";
/** The marks around the kit's block in a thin rule; the start is found by its prefix, so a release may reword the rest of it. */
export const BLOCK_START = "<!-- agentic-cms:start — the kit's lines: agentic-cms init --agent-files rewrites them; the site's own go after the end -->";
const START_PREFIX = "<!-- agentic-cms:start";
export const BLOCK_END = "<!-- agentic-cms:end -->";
/** The last line of every stub, which tells one from a copy of the kit's skill. */
export const STUB_NOTE = "<!-- written by agentic-cms init --agent-files and rewritten on every upgrade: never edit it -->";

/** Where the kit keeps what a site's agent file stands for: the whole rule, the skill, the settings template. */
export function kitPath(file) {
  if (file === SETTINGS) return `${PACKAGE}/${SETTINGS_TEMPLATE}`;
  const rule = file.match(/^\.claude\/rules\/(.+)$/);
  return rule ? `${PACKAGE}/${RULES}/${rule[1]}` : `${PACKAGE}/${file}`;
}

/** A text cut at its frontmatter: { front, body }, `front` with its fences and "" when the text opens with none. */
export function splitFront(text) {
  const match = text.match(/^---\n[\s\S]*?\n---\n/);
  return match ? { front: match[0], body: text.slice(match[0].length) } : { front: "", body: text };
}

/** A site's rule cut around the kit's block: { front, before, block, after }, `block` null when its marks are gone. */
export function ruleParts(text) {
  const { front, body } = splitFront(text);
  const start = body.indexOf(START_PREFIX);
  const end = start === -1 ? -1 : body.indexOf(BLOCK_END, start);
  if (end === -1) return { front, before: body, block: null, after: "" };
  return { front, before: body.slice(0, start), block: body.slice(start, end + BLOCK_END.length), after: body.slice(end + BLOCK_END.length) };
}

/** A site's thin rule, from the kit's whole rule and the site's file: the rule's paths, then the kit's block. */
export function thinRule(kitText, file) {
  const { front, body } = splitFront(kitText);
  const title = body.match(/^# .+$/m)?.[0];
  const pointer = `Before an edit these paths match, read the kit's whole rule, \`${kitPath(file)}\`, and follow it. ${REQUIRED}`;
  const lines = [BLOCK_START, ...(title ? [title, ""] : []), ...requiredSources(body).flatMap((block) => [block, ""]), pointer, BLOCK_END];
  return `${front}\n${lines.join("\n")}\n`;
}

/** The Codex stub of one of the kit's skills, from its text and the stub's file: the skill's name and description, and the package's file. */
export function codexStub(skillText, file) {
  const meta = splitFront(skillText).front.split("\n").filter((line) => /^(?:name|description):/.test(line));
  return `---\n${meta.join("\n")}\n---\n\nThe kit's skill, at the version this site installs: read \`${kitPath(file)}\` and follow it.\n\n${STUB_NOTE}\n`;
}
