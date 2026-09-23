// The lab's server: the index, a scene page or a bare page, a scene's file
// by its id (`?still=1`: without its animation, on all three), and a change
// stream that reloads the pages when a scene is saved. It serves a
// whitelist — the scenes it listed — and generated HTML, nothing else of
// the tree, which is what makes `--host 0.0.0.0` (a phone on the LAN)
// acceptable. The static server of the harness (browser.mjs) is not reused:
// it binds the loopback, gzips everything and routes like a Next build.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { LAB_DIR, animates, listScenes, sceneMeta, siteTokens, stripAnimation } from "./lab.mjs";
import { bareHtml, indexHtml, sceneHtml } from "./lab-page.mjs";

const NO_STORE = { "cache-control": "no-store" };
/** The sizes an icon-sized scene is shown at when the lab is given none; a bigger scene is shown at its own size only. */
export const ICON_SIZES = [24, 40, 64];
const ICON_SIZED = 96;

/** Every LAN address of this machine as a URL on the port (IPv4, not loopback). */
export function lanUrls(port) {
  return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => `http://${i.address}:${port}`);
}

const send = (res, status, type, body) => { res.writeHead(status, { "content-type": type, ...NO_STORE }); res.end(body); };
const html = (res, body) => send(res, 200, "text/html; charset=utf-8", body);
const notFound = (res) => send(res, 404, "text/plain", "not found");

/** Starts the server; { url, port, urls, close }. `extra` are more scene files or folders; `watch` streams changes to the pages; `sizes` apply to every scene (null: ICON_SIZES for an icon-sized one). */
export function startLabServer({ root = process.cwd(), extra = [], host = "127.0.0.1", port = 0, watch = false, sizes = null } = {}) {
  let scenes = listScenes(root, { extra });
  const tokens = siteTokens(root);
  const clients = new Set();
  const relist = () => { try { scenes = listScenes(root, { extra }); } catch { /* a folder removed mid-run: the list stays */ } };
  const metaOf = (file) => { try { return sceneMeta(fs.readFileSync(file, "utf8")); } catch { return null; } };
  const sizesFor = (meta) => sizes ?? (meta.width <= ICON_SIZED ? ICON_SIZES : []);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://lab");
    const p = decodeURIComponent(url.pathname);
    if (p === "/") {
      relist();
      const metas = new Map([...scenes].map(([id, file]) => [id, metaOf(file)]));
      return html(res, indexHtml(new Map([...scenes].map(([id, file]) => [id, path.relative(root, file)])), { tokens, metas }));
    }
    if (p === "/favicon.ico") { res.writeHead(204, NO_STORE); return res.end(); }
    if (p === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", ...NO_STORE, connection: "keep-alive" });
      res.write(": lab\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    const id = p.startsWith("/files/") && p.endsWith(".svg") ? p.slice(7, -4) : p.startsWith("/scene/") ? p.slice(7) : null;
    if (!id) return notFound(res);
    if (!scenes.has(id)) relist();
    const file = scenes.get(id);
    if (!file || !fs.existsSync(file)) return notFound(res);
    const source = fs.readFileSync(file, "utf8");
    const still = url.searchParams.get("still") === "1";
    const svg = still ? stripAnimation(source) : source;
    if (p.startsWith("/files/")) return send(res, 200, "image/svg+xml", svg);
    let meta;
    try { meta = sceneMeta(svg); } catch (error) { return send(res, 200, "text/plain", `${id}: ${error.message}`); }
    if (url.searchParams.get("bare") !== "1") return html(res, sceneHtml(id, { file: path.relative(root, file), meta, tokens, sizes: sizesFor(meta), animated: animates(source), still }));
    const width = Number(url.searchParams.get("width")) || meta.width;
    const height = Number(url.searchParams.get("height")) || Math.max(1, Math.round((width * meta.height) / meta.width));
    return html(res, bareHtml(id, svg, { tokens, scheme: url.searchParams.get("scheme") === "dark" ? "dark" : "light", background: url.searchParams.get("background") === "paper" ? "paper" : "transparent", width, height, pad: url.searchParams.get("pad"), fit: url.searchParams.get("fit") === "1" }));
  });

  // One watcher per folder that holds scenes; a save fans out as one event
  // per client after a short debounce (editors write a file in two steps).
  const watchers = [];
  if (watch) {
    let timer;
    const changed = () => { clearTimeout(timer); timer = setTimeout(() => { relist(); for (const c of clients) c.write("data: change\n\n"); }, 100); };
    const folders = new Set([path.join(root, LAB_DIR), ...[...scenes.values()].map((f) => path.dirname(f))].filter((d) => fs.existsSync(d)));
    for (const folder of folders) { try { watchers.push(fs.watch(folder, changed)); } catch { /* a platform without fs.watch: the pages still serve */ } }
  }

  return new Promise((resolve, reject) => {
    server.on("error", (error) => reject(error.code === "EADDRINUSE" ? new Error(`port ${port} is taken; pass --port`) : error));
    server.listen(port, host, () => {
      const bound = server.address().port;
      const local = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
      const urls = host === "0.0.0.0" || host === "::" ? [`http://localhost:${bound}`, ...lanUrls(bound)] : [`http://${local}:${bound}`];
      resolve({ url: `http://${local}:${bound}`, port: bound, urls, close: () => { for (const w of watchers) w.close(); for (const c of clients) c.end(); server.close(); } });
    });
  });
}
