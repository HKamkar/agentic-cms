#!/usr/bin/env node
// The README as npm's page shows it. npm serves the README of a published
// version and nothing else of the repository, and how it resolves a relative
// path is its own (a picture moved on main breaks every version already out).
// So a pack writes each relative picture and link as an address on the
// version's own tag, which never moves, and puts the README back after:
// prepack and postpack in package.json. In the repository the README stays
// relative, right on every branch.
//
//   node tools/npm-readme.mjs absolute   before the pack
//   node tools/npm-readme.mjs relative   after it
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PICTURE = /((?:src|srcset)=")(?![a-z]+:|\/\/|#)([^"]+)(")/g;
const IMAGE = /(!\[[^\]]*\]\()(?![a-z]+:|\/\/|#)([^)\s]+)(\))/g;
const LINK = /(\]\()(?![a-z]+:|\/\/|#)([^)\s]+)(\))/g; // an image's too, once IMAGE has had its turn
const HREF = /(href=")(?![a-z]+:|\/\/|#)([^"]+)(")/g;

/** The two addresses a version's files have: pictures raw, pages on GitHub. */
export const bases = ({ repository, version }) => {
  const [, repo] = repository.url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
  return { raw: `https://raw.githubusercontent.com/${repo}/v${version}/`, blob: `https://github.com/${repo}/blob/v${version}/` };
};

/** Each piece of markdown outside its code, through `each`. */
const outsideCode = (text, each) => text.split(/(^```[\s\S]*?^```|`[^`\n]+`)/m).map((piece, i) => (i % 2 ? piece : each(piece))).join("");

/** Every relative picture and link of a README, as written. */
export function relativeRefs(text) {
  const refs = [];
  outsideCode(text, (piece) => { for (const re of [PICTURE, LINK, HREF]) for (const [, , ref] of piece.matchAll(re)) refs.push(ref); return piece; });
  return refs;
}

/** The README with every relative picture and link on the version's tag. */
export const absolute = (text, { raw, blob }) => outsideCode(text, (piece) => piece
  .replace(PICTURE, (_, open, ref, close) => `${open}${raw}${ref}${close}`)
  .replace(IMAGE, (_, open, ref, close) => `${open}${raw}${ref}${close}`)
  .replace(LINK, (_, open, ref, close) => `${open}${blob}${ref}${close}`)
  .replace(HREF, (_, open, ref, close) => `${open}${blob}${ref}${close}`));

/** The way back: `relative(absolute(text))` is the text, to the byte. */
export const relative = (text, { raw, blob }) => text.replaceAll(raw, "").replaceAll(blob, "");

/** The files a README on the tag names, relative to the repository. */
export const named = (text, { raw, blob }) => [...text.matchAll(/https:\/\/[^\s")]+/g)].map(([url]) => url).flatMap((url) => [raw, blob].filter((base) => url.startsWith(base)).map((base) => decodeURI(url.slice(base.length).split("#")[0])));

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const way = { absolute, relative }[process.argv[2]];
  if (!way) { console.error("npm-readme: absolute or relative"); process.exit(2); }
  const file = path.join(ROOT, "README.md");
  fs.writeFileSync(file, way(fs.readFileSync(file, "utf8"), bases(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")))));
}
