// The page's HTML: every word of the story is in it, so it reads without the scene.
import { CH, UNITS } from "./timeline.js";

const REPO = "https://github.com/HKamkar/agentic-cms";
const TITLE = "agentic-cms: the life of one page";
const DESCRIPTION = "agentic-cms is a CMS with no database: content is files, an AI agent edits them, and what ships is static. The life of one page, told in six live scenes.";
const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='5' fill='%2304060b'/%3E%3Ccircle cx='12' cy='12' r='4' fill='%23ffa65c'/%3E%3C/svg%3E";
const POSTS = [
  ["the-voice-file-and-the-lint", "The voice file and the lint", "September 14, 2026", "One file holds the rules this site's copy follows, and one script enforces the half of them a machine can judge. What fails, what only warns, and which two reviewers read the rest."],
  ["pages-are-files", "Pages are files", "September 9, 2026", "A page on this CMS is one YAML file with three blocks. An SEO block, a structured-data block and a list of sections in order. Here is what each block holds and what the build does with it."],
  ["how-a-post-is-built", "How a post is built", "September 3, 2026", "Every part of a post on this CMS is a file or a convention inside that file. The two dates, the three images, the pull quote, the FAQ heading and the closing line, in the order you meet them."],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const pad = (n) => String(n).padStart(2, "0");
const words = (line) => line.split(" ").map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
const link = (href, label, cls = "") => `<a${cls ? ` class="${cls}"` : ""} href="${href}" target="_blank" rel="noopener">${label}</a>`;

const ENDING = `<p class="cmd late" id="cmd"><code><span>pnpm dlx agentic-cms init my-site</span> <span>--name "My Site"</span></code><button type="button" id="copy">Copy</button></p><p class="acts late">${link(`${REPO}#start-your-own-site`, "Start a site", "btn")}${link(REPO, "Read the code", "btn ghost")}</p><p class="fine late">Open source, MIT. Node 22.18 or later, and pnpm. It starts as a wireframe, and the design is yours.</p>`;

const caption = (c, i) => `<div class="cap"><p class="num"><b>${pad(i + 1)}</b><i></i>${pad(CH.length)}</p><h2 class="capname">${c.name}</h2><p>${esc(c.cap)}</p></div>`;
const slide = (c) => `<div class="slide"><div class="in"><p class="eye late"><i></i>${c.eye}<i></i></p><h3 class="big">${c.head.map((l) => `<span class="ln">${words(l)}</span>`).join(" ")}</h3><p class="body late">${esc(c.body)}</p>${c.final ? ENDING : ""}</div></div>`;
const chapter = (c, i) => `<section class="chapter" id="${c.id}" style="--a:${c.accent}">${caption(c, i)}<canvas class="still" data-still="${i}" aria-hidden="true"></canvas>${slide(c)}</section>`;

const HEADER = `<header class="bar"><a class="brand" href="#top"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="3.4" fill="currentColor"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-opacity=".5"/><path d="M1 12h4M19 12h4" stroke="currentColor"/></svg>agentic-cms</a><nav><a href="#top">Story</a><a href="#blog">Blog</a>${link(REPO, "GitHub")}</nav></header>`;
const HERO = `<div id="hero"><p class="eye"><i></i>The life of one page<i></i></p><h1><span class="ln">An agent writes.</span> <span class="ln">The build reads every word.</span></h1><p>agentic-cms is a CMS with no database. Content is files, an AI agent edits them, and what ships is static.</p></div>`;
const PLAY = `<button id="play" type="button" aria-pressed="false"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-opacity=".22"/><circle id="ring" cx="20" cy="20" r="18" fill="none" stroke="var(--accent)" stroke-width="1.6" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 20 20)"/><path class="tri" d="M17 14.5v11l9-5.5z" fill="currentColor"/><path class="pau" d="M15.5 14.5h3v11h-3zM21.5 14.5h3v11h-3z" fill="currentColor"/></svg><span id="playtext">Play the story</span></button>`;
const SIDE = `<div id="side">${PLAY}<div id="now"></div><nav id="rail" aria-label="Chapters">${CH.map((c) => `<a href="#${c.id}" aria-label="${c.name}"></a>`).join("")}</nav><button id="speed" type="button" aria-pressed="false">Frame rate</button><pre id="read" hidden></pre></div>`;
const STORY = `<main id="home"><span id="top"></span><div id="track" data-story style="--u:${(UNITS + 1) * 100}lvh"><div id="stage" data-story-stage><canvas id="gl" aria-hidden="true"></canvas>${HERO}<div id="labels" aria-hidden="true"></div>${CH.map(chapter).join("")}${SIDE}<p id="hint" aria-hidden="true">Scroll to begin<i></i></p></div></div></main>`;
const post = ([file, title, date, line]) => `<section><p class="date">${date}</p><h2>${link(`${REPO}/blob/main/content/blog/${file}.md`, title)}</h2><p>${line}</p><p class="date">content/blog/${file}.md</p></section>`;
const BLOG = `<article id="blog" hidden><div class="wrap"><h1>Blog</h1><p class="lead">A regular page: no pinned stage, no 3D, no motion. These are the posts of the example site, and each title opens its file.</p>${POSTS.map(post).join("")}<section><h2>About this demo</h2><p>The story on the home page is hand-written WebGL2, with no library, and these pages are plain text. A site starts as a wireframe: the design, and a story like this one, is its own. How it is made is ${link(`${REPO}/blob/main/docs/motion-story.md`, "docs/motion-story.md")}.</p></section></div></article>`;
const MODE = `if(window.WebGL2RenderingContext&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.mode='story'`;

/** The whole page, its styles and its script inside it; `preload` is a font to ask for at once, `index` false keeps the page out of search engines. */
export const page = ({ css, script, preload = null, index = false }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
${index ? "" : '<meta name="robots" content="noindex">\n'}<meta name="theme-color" content="#04060b">
<link rel="icon" href="${ICON}">
${preload ? `<link rel="preload" href="${preload}" as="font" type="font/woff2" crossorigin>\n` : ""}<script>${MODE}</script>
<style>
${css}
</style>
</head>
<body>
<a class="skip" href="#blog">Skip the story</a>
${HEADER}
${STORY}
${BLOG}
<script>
${script}
</script>
</body>
</html>
`;
