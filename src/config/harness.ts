// What the screenshot harness reads about this site (docs/visual-parity.md);
// the app never imports this file.
//
// The seed: what the harness writes into every page's storage before the
// page's scripts run — a refused consent choice, so captures, shots and
// probes show the site after a visitor has chosen (no banner over the page,
// no tag) rather than a first visit. `--no-storage` shows the banner itself.
//
// The profile: what every capture command takes unless a flag says
// otherwise — the schemes the site has (a proof runs a pass in each) and the
// ref a proof's baseline is built from.
import { analytics } from "./analytics";

const { storageKey, version } = analytics.consent;

export const harness = {
  storage: { [storageKey]: { analytics: "denied", at: "{now}", version } },
  schemes: ["light", "dark"],
  proof: { ref: "develop" },
};
