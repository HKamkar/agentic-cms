import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parse } from "../scripts/lib/args.mjs";
import { FAMILIES, SPECS } from "../scripts/lib/specs.mjs";


/** The commands that run: a spec without subcommands, else its subcommands' leaves, however deep. */
const leavesOf = (spec) => (spec.subcommands ? Object.values(spec.subcommands).flatMap(leavesOf) : [spec]);

test("every spec names a script that exists, and its command is its key", () => {
  for (const [key, spec] of Object.entries(SPECS)) {
    assert.equal(spec.command, key);
    assert.ok(spec.script, `${key} names its script`);
    assert.ok(fs.existsSync(path.resolve(import.meta.dirname, `../scripts/${spec.script}.mjs`)), `scripts/${spec.script}.mjs`);
    assert.ok(FAMILIES.some((f) => f.group === spec.group), `${key} names its family, one of FAMILIES`);
    const leaves = leavesOf(spec);
    for (const leaf of leaves) {
      assert.ok(leaf.summary && leaf.usage && leaf.exit, `${leaf.command} has a summary, a usage and exit codes`);
      assert.ok(Array.isArray(leaf.examples) && leaf.examples.length && leaf.examples.every((e) => e.startsWith(`agentic-cms ${leaf.command}`)), `${leaf.command} has an example, and it starts with the command`);
      for (const [name, flag] of Object.entries(leaf.flags ?? {})) {
        assert.ok(["number", "string", "boolean"].includes(flag.type), `${leaf.command} --${name} has a type`);
        if (flag.choices) assert.ok(flag.choices.length > 1 && (flag.default === undefined || flag.choices.includes(flag.default)), `${leaf.command} --${name}: choices and the default among them`);
      }
    }
  }
});

test("a command whose help says what --json prints takes --json: probe, which prints nothing else, takes it too", () => {
  for (const leaf of Object.values(SPECS).flatMap(leavesOf).filter((spec) => spec.json)) {
    assert.equal(leaf.flags?.json?.type, "boolean", `${leaf.command}: its help says "--json prints ${leaf.json.slice(0, 30)}…", so --json is a flag`);
  }
  assert.equal(parse(SPECS.probe, ["/", "--select", ".card", "--motion", "--json"]).flags.json, true);
});

test("every family has a layer of the map and a command, and none is listed twice", () => {
  const layers = ["the content engine", "design tools", "the site's commands"];
  assert.equal(new Set(FAMILIES.map((f) => f.group)).size, FAMILIES.length);
  for (const { group, layer } of FAMILIES) {
    assert.ok(layers.includes(layer), `${group}: ${layer} is one of the layers in docs/parts.md`);
    assert.ok(Object.values(SPECS).some((spec) => spec.group === group), `${group} has a command`);
  }
  assert.deepEqual([...new Set(FAMILIES.map((f) => f.layer))], layers, "the families run in the layers' order");
});

const ROOT = path.resolve(import.meta.dirname, "..");
const markdown = (dir) => (fs.existsSync(path.join(ROOT, dir)) ? fs.readdirSync(path.join(ROOT, dir), { recursive: true }).filter((file) => file.endsWith(".md")).map((file) => `${dir}/${file}`) : []);
/** Every guide a reader or an agent runs commands from: the README, docs/, both AGENTS.md, the rules and the skills. */
const GUIDES = ["README.md", "AGENTS.md", "templates/site/AGENTS.md", ...markdown("docs"), ...markdown(".claude/rules"), ...markdown("templates/site/rules"), ...markdown(".claude/skills")];
/** A command line as the guides write it: the command, then its words up to a pipe, a semicolon, an `&&` or a comment. */
const CALL = /(?:pnpm kit|pnpm exec agentic-cms|(?<![\w/@-])agentic-cms) ([a-z][\w-]*)((?: +[^\s`|&;#]+)*)/g;

/** The leaf a command line runs, and its words after the command: the spec's subcommands followed as far as the words name them. */
function leafOf(command, words) {
  let spec = SPECS[command];
  while (spec?.subcommands && spec.subcommands[words[0]]) spec = spec.subcommands[words.shift()];
  return spec && !spec.subcommands ? spec : null;
}

test("every flag a guide writes on a command line is that command's own, so nothing a reader copies exits on an unknown flag", () => {
  const wrong = [];
  for (const guide of GUIDES) {
    const text = fs.readFileSync(path.join(ROOT, guide), "utf8");
    const code = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].flatMap((block) => block[1].split("\n"));
    const inline = [...text.replace(/```[\s\S]*?```/g, "").matchAll(/`([^`\n]+)`/g)].map((span) => span[1]);
    // The harness guide names a flag with its subcommand alone, as in its table of settings: `proof --pages`.
    const harness = guide === "docs/visual-parity.md" ? inline.filter((span) => /^(?:capture|compare|proof|clean) --/.test(span)).map((span) => `agentic-cms visual-parity ${span}`) : [];
    for (const line of [...code, ...inline, ...harness]) {
      for (const [, command, rest] of line.matchAll(CALL)) {
        const words = rest.trim().split(/ +/).filter(Boolean);
        const leaf = leafOf(command, words);
        for (const flag of words.map((word) => word.match(/^--([a-z][\w-]*)/)?.[1]).filter(Boolean)) if (leaf && flag !== "help" && !Object.hasOwn(leaf.flags ?? {}, flag)) wrong.push(`${guide}: ${leaf.command} has no --${flag} (${line.trim().slice(0, 90)})`);
      }
    }
  }
  assert.deepEqual(wrong, []);
  assert.equal(Object.hasOwn(SPECS["visual-parity"].subcommands.capture.flags, "all-pages"), false, "a capture takes every page unless it names its own; the profile narrows a proof alone");
});
