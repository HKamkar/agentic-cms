// What the screenshot harness reads about this site (docs/visual-parity.md);
// the app never imports this file.
//
// The seed: what the harness writes into every page's storage before the
// page's scripts run — a refused consent choice, so captures, shots and
// probes show the site after a visitor has chosen (no banner over the page,
// no tag) rather than a first visit. `--no-storage` shows the banner itself.
//
// The profile: what every capture command takes unless a flag says
// otherwise — the widths the site is designed and proved at (390 below
// base.css's 768 step, 768 below its 992, 1440 and 1920 above; the menu is
// open at the two below 992), the schemes it has (a proof runs a pass in
// each) and the ref a proof's baseline is built from.
import { analytics } from "./analytics";

const { storageKey, version } = analytics.consent;

export const harness = {
  storage: { [storageKey]: { analytics: "denied", at: "{now}", version } },
  widths: [390, 768, 1440, 1920],
  schemes: ["light", "dark"],
  proof: { ref: "develop" },
};
