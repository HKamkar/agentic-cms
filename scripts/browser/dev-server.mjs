// The example site's own dev server for a browser test: next dev on a free
// loopback port (scripts/lib/dev-server.mjs, which `serve` runs too),
// resolved once it is ready, stopped with its process group.
import path from "node:path";
import { freePort, startDevServer } from "../lib/dev-server.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** { url, port, stop }; `env` adds to the server's environment (a tag id, say). `stop()` resolves once the server exited. Rejects with the log's tail when the server exits or is not ready in two minutes. */
export async function devServer(root = ROOT, { env = {} } = {}) {
  const port = await freePort();
  const server = await startDevServer({ root, port, host: "127.0.0.1", env });
  return { url: server.url, port, stop: () => server.stop() };
}
