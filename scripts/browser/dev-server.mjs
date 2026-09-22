// The example site's own dev server for a browser test: next dev on a free
// loopback port, resolved once it is ready, stopped with its process group.
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const NEXT = path.join(ROOT, "node_modules/next/dist/bin/next");
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

/** { url, stop }; rejects with the log's tail when the server exits or is not ready in two minutes. */
export async function devServer(root = ROOT) {
  const port = await freePort();
  const child = spawn(process.execPath, [NEXT, "dev", "-p", String(port), "-H", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`next dev not ready in 120s:\n${log.slice(-800)}`)), 120000);
    const onData = (chunk) => { log += chunk; if (/Ready in/.test(log)) { clearTimeout(timer); resolve(); } };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => { clearTimeout(timer); reject(new Error(`next dev exited ${code}:\n${log.slice(-800)}`)); });
  });
  return { url: `http://127.0.0.1:${port}`, stop: () => { try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); } } };
}
