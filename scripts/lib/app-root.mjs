// Where a route of the site's default language goes: src/app, or, in a
// site whose root layouts are each language's (docs/locales.md), the route
// group that holds the default language's, src/app/(<group>)/. A design
// round's route and the lab's go there, so they render inside the site's
// document; a route group changes no URL, so theirs is the same either way.
import fs from "node:fs";
import path from "node:path";

export const APP = "src/app";
/** A route group's folder: a name in parentheses, which Next leaves out of the URL. */
export const ROUTE_GROUP = /^\(.+\)$/;

/** The folder that holds the default language's root layout, root-relative: src/app, or the first route group under it with a layout. */
export function defaultRoot(root, fsys = fs) {
  const app = path.join(root, APP);
  if (!fsys.existsSync(app) || fsys.existsSync(path.join(app, "layout.tsx"))) return APP;
  const group = fsys.readdirSync(app).sort().find((name) => ROUTE_GROUP.test(name) && fsys.existsSync(path.join(app, name, "layout.tsx")));
  return group ? `${APP}/${group}` : APP;
}
