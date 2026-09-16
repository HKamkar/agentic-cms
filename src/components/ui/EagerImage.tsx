"use client";

import type { ImgHTMLAttributes } from "react";

/**
 * An eager <img> for above-the-fold pictures rendered by server components.
 * A plain <img> in a server component becomes a preload hint in the page's
 * RSC payload, and every other page executes that hint the moment it
 * prefetches a link here, downloading pictures it never shows (the blog
 * index was fetching the hero of every post it linked to). Client components
 * are not part of that payload, so the picture is only requested by the page
 * that renders it, which still preloads it from <head> as before.
 */
export function EagerImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line jsx-a11y/alt-text -- alt comes in through props
  return <img {...props} />;
}
