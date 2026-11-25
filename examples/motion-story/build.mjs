#!/usr/bin/env node
// The story as one file: the modules of src/ joined in their order, without a
// bundler, inside the page that holds every word of it.
//
//   node examples/motion-story/build.mjs [--out <file>] [--fonts <dir>] [--index]
//
// --out    where to write it (default dist/index.html beside this file)
// --fonts  a folder, relative to the page, with figtree.woff2 and
//          jetbrains-mono.woff2; without it the page uses the system's fonts
// --index  leave out the noindex
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import zlib from "node:zlib";
import { page } from "./src/page.js";

const HERE = import.meta.dirname;
const { values: flags } = parseArgs({ options: { out: { type: "string", default: path.join(HERE, "dist/index.html") }, fonts: { type: "string" }, index: { type: "boolean", default: false } } });
const read = (file) => fs.readFileSync(path.join(HERE, "src", file), "utf8");

const withoutModules = (source) => source.replace(/^import [\s\S]*?;$/gm, "").replace(/^export /gm, "");
const withoutComments = (source) => source.replace(/^\s*\/\/.*$/gm, "").replace(/^ +/gm, "").replace(/\n{2,}/g, "\n");
const inShaders = (source) => source.replace(/ \/\/ [a-z][^\n]*$/gm, "");
const joined = (file) => withoutComments(withoutModules(read(file)));

const face = (family, file, weight) => `@font-face{font-family:"${family}";src:url(${flags.fonts}/${file}) format("woff2");font-weight:${weight};font-display:swap}`;
const fonts = flags.fonts ? `${face("Figtree", "figtree.woff2", "400 600")}${face("JetBrains Mono", "jetbrains-mono.woff2", "400 500")}\n` : "";
const css = fonts + "[hidden]{display:none!important}\n" + read("style.css").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\n\s*/g, " ");
const script = `(()=>{\n${[joined("geo.js"), joined("timeline.js"), inShaders(joined("shaders.js")), joined("renderer.js"), joined("governor.js"), joined("story.js")].join("\n")}\n})();`;
const html = page({ css, script, preload: flags.fonts ? `${flags.fonts}/figtree.woff2` : null, index: flags.index });
fs.mkdirSync(path.dirname(path.resolve(flags.out)), { recursive: true });
fs.writeFileSync(flags.out, html);
console.log(`${flags.out}: ${(zlib.gzipSync(html).length / 1024).toFixed(1)} KB compressed`);
