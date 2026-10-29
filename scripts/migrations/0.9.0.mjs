// 0.8.x → 0.9.0, run by `agentic-cms upgrade` (lib/upgrade.mjs). Each piece
// is what one job of docs/roadmap.md changes in a site, added by the job that
// brings it: detect() lists what it would change, apply() changes it and says
// what is left by hand; both idempotent, so a second run changes nothing and
// still names a manual step the site has not taken.
//   job 10, the agent files: 0.8's copies moved (lib/agent-files-move.mjs),
//     and the site's own AGENTS.md and CLAUDE.md told what to replace;
//   job 8, the content schemas: each YAML content file's schema line
//     (lib/content-schema.mjs), then content/_schemas/ and the field tables
//     written by the site's own installed command line, which loads its
//     registry.
// Job 9 adds the site's redirects, job 3 the dependency's spec.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { legacyFiles, moveLegacy } from "../lib/agent-files-move.mjs";
import { SCHEMAS, schemaLineEdits } from "../lib/content-schema.mjs";

/** Where each manual step is written: its section of the upgrade guide in the installed package. */
export const GUIDE = "node_modules/agentic-cms/docs/upgrading.md#084--090";

const read = (site, file) => { try { return fs.readFileSync(path.join(site, file), "utf8"); } catch { return null; } };

/** What 0.8's templates copied into a site's AGENTS.md and CLAUDE.md, by the lines that say it. */
const COPIED = [
  { file: "AGENTS.md", marks: ["## Styling\n", "## Gotchas\n", "## Parity harness and long runs\n", "The kit's know-how is under `node_modules/agentic-cms/docs/`"], text: "AGENTS.md holds what the 0.8 template copied from the kit's docs (its styling, gotchas and parity-harness sections, the list of the kit's docs): put the current template's table, \"The kit's guides\", in their place (node_modules/agentic-cms/templates/site/AGENTS.md)" },
  { file: "CLAUDE.md", marks: ["the design skills are `.claude/skills/`"], text: "CLAUDE.md says the design skills are .claude/skills/: they are the kit's design plugin now (node_modules/agentic-cms/templates/site/CLAUDE.md)" },
];
/** The note the move writes at the top of a skill it made the site's own. */
const OWN_NOTE = "This site's own version of the kit's";

/** The skills the move made the site's own that still carry its note. */
function ownSkills(site) {
  return [".claude/skills", ".agents/skills"].flatMap((tree) => {
    if (!fs.existsSync(path.join(site, tree))) return [];
    return fs.readdirSync(path.join(site, tree)).filter((name) => name.endsWith("-site") && (read(site, `${tree}/${name}/SKILL.md`) ?? "").includes(OWN_NOTE)).map((name) => `${tree}/${name}`);
  });
}

/** What the agent files leave by hand: [{ text, link }]. */
function agentManual(site) {
  const copied = COPIED.filter(({ file, marks }) => { const text = read(site, file); return text !== null && marks.some((mark) => text.includes(mark)); });
  const own = ownSkills(site).map((dir) => ({ text: `${dir} is the site's edit of the kit's skill, kept as its own: keep it, or delete it to follow the kit's` }));
  return [...copied, ...own].map(({ text }) => ({ text, link: GUIDE }));
}

const AGENT_FILES = {
  piece: "agent files",
  detect: (site, { kitRoot }) => [
    ...legacyFiles(site, { kitRoot }).map((file) => `${file}: what init copied before 0.9.0, to move`),
    ...agentManual(site).map(({ text }) => `by hand: ${text}`),
  ],
  apply: (site, { kitRoot, log }) => ({ changed: moveLegacy(site, { kitRoot, log }), manual: agentManual(site) }),
};

/** The standard collections whose files are YAML: where the schema line goes without the site's registry (its own collections take theirs from `schema --lines`). */
export const YAML_COLLECTIONS = {
  reviews: { name: "reviews", kind: "list", file: "reviews.yaml" },
  faqs: { name: "faqs", kind: "folder", dir: "faqs", format: "yaml" },
  useCases: { name: "useCases", kind: "list", file: "use-cases.yaml" },
  pages: { name: "pages", kind: "folder", dir: "pages", format: "yaml" },
};
/** The site's installed command line, which loads its own registry (`pnpm add` installed this release's); null without one. */
const installedBin = (site) => { const bin = path.join(site, "node_modules/agentic-cms/bin/agentic-cms.mjs"); return fs.existsSync(bin) ? bin : null; };
const SCHEMAS_BY_HAND = `run agentic-cms schema --lines, then agentic-cms docs, in the site's root: they write ${SCHEMAS}/, the JSON Schemas of the site's collections, the field tables of content/README.md and the schema line of a collection of the site's own, which docs --check in the build checks`;

const CONTENT_SCHEMAS = {
  piece: "content schemas",
  detect: (site) => [
    ...schemaLineEdits(site, YAML_COLLECTIONS, { fs }).map(({ file }) => `${file}: its first line to name its JSON Schema`),
    ...(fs.existsSync(path.join(site, SCHEMAS)) ? [] : [`${SCHEMAS}/: the JSON Schemas of the site's collections, to write`]),
  ],
  apply: (site, { log }) => {
    const changed = schemaLineEdits(site, YAML_COLLECTIONS, { fs }).map(({ file, text }) => { fs.writeFileSync(path.join(site, file), text); return { file, status: "schema line" }; });
    if (fs.existsSync(path.join(site, SCHEMAS))) return { changed, manual: [] };
    const bin = installedBin(site);
    const ran = bin && [["schema", "--lines"], ["docs"]].every((args) => { log(`agentic-cms ${args.join(" ")}`); return spawnSync(process.execPath, [bin, ...args], { cwd: site, stdio: "ignore" }).status === 0; });
    return ran ? { changed: [...changed, { file: `${SCHEMAS}/`, status: "written" }], manual: [] } : { changed, manual: [{ text: SCHEMAS_BY_HAND, link: GUIDE }] };
  },
};

/** The pieces, in the order they apply. */
export const PIECES = [AGENT_FILES, CONTENT_SCHEMAS];

/** What the migration would change: [{ piece, what }]. */
export const detect = (site, context) => PIECES.flatMap(({ piece, detect: found }) => found(site, context).map((what) => ({ piece, what })));

/** Changes what detect() finds: { changed: [{ piece, file, status, note? }], manual: [{ piece, text, link }] }. */
export function apply(site, context) {
  const changed = [];
  const manual = [];
  for (const { piece, apply: change } of PIECES) {
    const done = change(site, context);
    changed.push(...done.changed.map((entry) => ({ piece, ...entry })));
    manual.push(...done.manual.map((step) => ({ piece, ...step })));
  }
  return { changed, manual };
}
