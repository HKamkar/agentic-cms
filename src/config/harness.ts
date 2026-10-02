// What the screenshot harness writes into every page's storage before the
// page's scripts run (docs/visual-parity.md): a refused consent choice, so
// captures, shots and probes show the site after a visitor has chosen — no
// banner over the page, no tag — rather than a first visit. `--no-storage`
// shows the banner itself. The app never imports this file.
import { analytics } from "./analytics";

const { storageKey, version } = analytics.consent;

export const harness = {
  storage: { [storageKey]: { analytics: "denied", at: "{now}", version } },
};
