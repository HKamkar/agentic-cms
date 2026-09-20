// The inventory behind `agentic-cms icons audit`: every icon on the built
// pages — an <img> rendered at 96 px or less, an inline <svg> — with what it
// sits beside (its section, the nearest heading, the copy of its card), so
// "one instance means the class" starts from the whole class. The in-page
// function runs in the browser; auditToSheet() turns the result into a
// sheet spec, one row per page, each icon as a cell labelled with its copy.

/** In the page: the icons and their context. */
export const AUDIT_PAGE = (max) => {
  // innerText keeps a space between the blocks of a card, which textContent runs together
  const text = (el) => (el?.innerText ?? el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const near = (el) => {
    const card = el.closest("li, article, a, figure, [class*='card']") ?? el.parentElement;
    const copy = text(card).slice(0, 80);
    const section = el.closest("section, [data-section]");
    const heading = text(section?.querySelector("h1, h2, h3"));
    return { section: section?.id || section?.dataset?.section || null, heading: heading.slice(0, 80) || null, copy: copy || null };
  };
  const selector = (el) => { const parts = []; for (let e = el; e && e !== document.body; e = e.parentElement) { const tag = e.tagName.toLowerCase(); const id = e.id ? `#${e.id}` : ""; const nth = e.parentElement ? `:nth-child(${[...e.parentElement.children].indexOf(e) + 1})` : ""; parts.unshift(id ? `${tag}${id}` : `${tag}${nth}`); if (id) break; } return parts.join(" > "); };
  const out = [];
  for (const img of document.images) {
    const r = img.getBoundingClientRect();
    if (r.width > max || r.height > max || r.width === 0) continue;
    out.push({ kind: "img", src: img.getAttribute("src"), width: Number(img.getAttribute("width")) || null, height: Number(img.getAttribute("height")) || null, renderedWidth: Math.round(r.width), renderedHeight: Math.round(r.height), color: getComputedStyle(img).color, alt: img.alt, ...near(img), selector: selector(img) });
  }
  for (const svg of document.querySelectorAll("svg")) {
    if (svg.closest("svg") !== svg) continue;
    const r = svg.getBoundingClientRect();
    if (r.width > max || r.height > max || r.width === 0) continue;
    // the drawing alone: the site's classes on the svg would lay it out on the sheet as they do on the page
    const bare = svg.cloneNode(true);
    bare.removeAttribute("class"); bare.removeAttribute("style");
    out.push({ kind: "svg", src: null, paths: svg.querySelectorAll("path").length, fill: svg.getAttribute("fill"), renderedWidth: Math.round(r.width), renderedHeight: Math.round(r.height), color: getComputedStyle(svg).color, markup: bare.outerHTML.slice(0, 4000), ...near(svg), selector: selector(svg) });
  }
  return out;
};

/** A sheet spec from an audit: one row per page, every icon a cell at its rendered size, labelled with the copy it sits beside. */
export function auditToSheet(report, { background, color } = {}) {
  return {
    name: "icons audit",
    ...(background ? { background } : {}),
    ...(color ? { color } : {}),
    rows: report.pages.map((page) => ({
      label: page,
      note: `${report.icons.filter((i) => i.page === page).length} icons`,
      size: Math.max(24, ...report.icons.filter((i) => i.page === page).map((i) => i.renderedWidth)),
      cells: report.icons.filter((i) => i.page === page).map((i) => ({ label: (i.copy ?? i.heading ?? i.selector).slice(0, 28), ...(i.kind === "img" ? { img: i.src } : { svg: i.markup }) })),
    })).filter((row) => row.cells.length),
  };
}

/** The icons grouped by file: uses, pages. */
export function byFile(icons) {
  const files = {};
  for (const icon of icons.filter((i) => i.src)) {
    files[icon.src] ??= { uses: 0, pages: [] };
    files[icon.src].uses++;
    if (!files[icon.src].pages.includes(icon.page)) files[icon.src].pages.push(icon.page);
  }
  return files;
}
