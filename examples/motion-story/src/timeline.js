// ---------- the story: six chapters on one timeline ----------
export const C = {
  sea: "#5cc8ff",
  deep: "#2457d6",
  storm: "#6f8cff",
  rose: "#ff5b86",
  ice: "#9be2ff",
  signal: "#4b86ff",
  alert: "#ff5a46",
  pass: "#5be3b4",
  leaf: "#4fd39c",
  gold: "#ffc978",
  dawn: "#ffa65c",
  ink: "#eaf3ff",
};
export const CH = [
  {
    id: "sea",
    name: "The open sea",
    accent: C.sea,
    scene: 2.2,
    cap: "A voice memo, half a post, a slide from last year. The words exist before the page does.",
    eye: "The brief",
    head: ["The words are already there", "They have no shore yet"],
    body: "Hand one of them to the agent as a brief. It comes back with an outline, and waits for your yes.",
  },
  {
    id: "storm",
    name: "The storm",
    accent: C.storm,
    scene: 2.2,
    cap: "A row in a database, a block in a builder, a string in a component. Every copy changes a little.",
    eye: "The drift",
    head: ["Copies multiply", "The truth gets harder to find"],
    body: "One price in the brochure, another on the site, a third in the code. An agent that only writes adds a fourth.",
  },
  {
    id: "spine",
    name: "The spine",
    accent: C.ice,
    scene: 2.2,
    cap: "One file for each page. Its SEO, its copy and its structured data, each in its place.",
    eye: "The file",
    head: ["A page is a file", "The agent edits it there"],
    body: "Every word a reader sees comes from content/ or the site's config. A change is a diff, and a person merges it.",
  },
  {
    id: "gate",
    name: "The gate",
    accent: C.signal,
    scene: 2.4,
    cap: "Nothing passes unread. What fails is held, and the reason is printed.",
    eye: "The build",
    head: ["The build says no", "and it says why"],
    body: "Every file is read against its schema and your voice rules, every built page against its SEO. A failure names the place and the problem, so the agent can fix it.",
  },
  {
    id: "tree",
    name: "The tree",
    accent: C.leaf,
    scene: 3.4,
    cap: "What passed takes root. The light climbs, the branches follow, and every page finds its place.",
    eye: "The site",
    head: ["One root", "Every page in its season"],
    body: "Pages, posts, the feed and the sitemap all grow from content/. Retire a page, and the agent writes its redirect.",
  },
  {
    id: "light",
    name: "First light",
    accent: C.dawn,
    scene: 2.4,
    cap: "The page is built once. From here on it is a file.",
    eye: "The reader",
    head: ["The page is already there", "before the reader asks"],
    body: "Prerendered, and served from a Cloudflare Worker or a Node server. No database, no admin screen, nothing read at request time.",
    final: true,
  },
];
export const T_OUT = 0.55;
export const T_SLIDE = 1.05;
const T_IN = 0.6;
let acc = 0;
for (const c of CH) {
  c.s0 = acc;
  c.s1 = acc + c.scene;
  c.t0 = c.s1 + (c.final ? 0.5 : T_OUT);
  c.t1 = c.t0 + (c.final ? 1.2 : T_SLIDE);
  c.end = c.final ? c.t1 : c.t1 + T_IN;
  acc = c.end;
}
export const UNITS = acc;
