// The site's profile: what a site says once about itself, in the `harness`
// export of src/config/harness.ts beside its seed — the widths it is
// designed at, the colour schemes it has, the pages a proof covers and the
// ref it proves against — so every command's default is the site's, not the
// kit's:
//
//   export const harness = {
//     storage: { … },
//     widths: [390, 768, 1440, 1920],
//     schemes: ["light"],                  // or ["light", "dark"]
//     proof: { pages: ["/"], ref: "develop" },   // or { sample: 1 }: one page of each template
//   };
//
// A flag wins, then the profile, then the built-in default — the value every
// command had before profiles existed, so a site without one, or a key it
// leaves out, gets what it always got. lib/storage-seed.mjs reads and checks
// the file; docs/visual-parity.md has the contract.
import { SeedError, readSiteProfile } from "./storage-seed.mjs";

/** The built-in defaults: what a capture took before profiles, and still takes for a site without one. */
export const DEFAULT_WIDTHS = [1920, 1440, 1280, 1100, 992, 800, 767, 390];
export const DEFAULT_SCHEMES = ["light"];
export const DEFAULT_REF = "develop";
/** --motion's own widths: its frames are timed, one desktop and one phone are what it judges. */
export const MOTION_WIDTHS = [1440, 390];
/** The menu's widths without a profile; with one, the profile's widths at which the menu button shows. */
export const MENU_WIDTHS = [767, 390];

/** The site's profile, or null; a profile that does not read prints its problem under the command's name and exits 2. */
export async function profileOrExit(command, root = process.cwd()) {
  try { return await readSiteProfile(root); } catch (error) {
    if (!(error instanceof SeedError)) throw error;
    console.error(`${command}: ${error.message}`);
    process.exit(2);
  }
}

/** One command's scheme: --scheme, then the profile's first, then light. */
export const schemeOf = (flag, profile) => flag ?? profile?.schemes?.[0] ?? DEFAULT_SCHEMES[0];

/** A command's scheme without reading the profile when the flag names one. */
export const schemeOrExit = async (flags, command) => (flags.scheme ? flags.scheme : schemeOf(undefined, await profileOrExit(command)));

/** A capture's widths: --widths, then --motion's own, then the profile's, then the built-in eight. */
export function captureWidths({ flag, motion = false, profile = null }) {
  if (flag) return flag.split(",").filter(Boolean).map(Number);
  return motion ? MOTION_WIDTHS : profile?.widths ?? DEFAULT_WIDTHS;
}

/** The widths at which the home page's menu is opened and shot, where its button shows: the profile's widths, else the built-in two. */
export const menuWidths = (profile) => profile?.widths ?? MENU_WIDTHS;

/** Whether a capture opens the home page's menu at a page-width: a static capture of the home page, at one of the menu widths. */
export const opensMenu = ({ pagePath, width, menuWidths: at, motion = false, states = false }) => !motion && !states && pagePath === "/" && at.includes(width);

/**
 * What a proof runs on: the ref its baseline is built from, the schemes it runs a pass in each of, the pages
 * of every capture and compare, and the sample of each template its static pass takes (both undefined: every
 * page). A flag wins, then the profile, then the default; --pages, --sample and --all-pages are three ways of
 * choosing the pages, so any of them sets aside both of the profile's (which sets one at most).
 */
export function proofSettings(flags, profile = null) {
  const chosen = flags.pages !== undefined || flags.sample !== undefined || Boolean(flags["all-pages"]);
  const pages = flags.pages ?? (chosen ? undefined : profile?.proof?.pages?.join(","));
  const sample = flags.sample ?? (chosen ? undefined : profile?.proof?.sample);
  return { ref: flags.ref ?? profile?.proof?.ref ?? DEFAULT_REF, schemes: flags.scheme ? [flags.scheme] : profile?.schemes ?? DEFAULT_SCHEMES, pages, sample };
}
