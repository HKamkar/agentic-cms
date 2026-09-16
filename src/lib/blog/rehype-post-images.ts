// Every picture in a post body: loads lazily (all of them sit below the hero;
// eager, they would also become preload hints that other pages execute when
// they prefetch the post) and carries its width and height, read from the
// file under public/, so the page reserves the space before the image loads.
// Applies to markdown images and to <img> tags written as raw HTML alike.
// image-size is pure JavaScript on purpose: this runs inside the server
// bundle OpenNext builds, where a native module such as sharp cannot go.
import fs from "node:fs";
import path from "node:path";
import type { Element, Root } from "hast";
import { imageSize } from "image-size";

const sizes = new Map<string, { width?: number; height?: number }>();

function sizeOf(src: string) {
  const file = path.join(process.cwd(), "public", decodeURIComponent(src));
  if (!sizes.has(src)) {
    try {
      const { width, height } = imageSize(fs.readFileSync(file));
      sizes.set(src, { width, height });
    } catch {
      sizes.set(src, {});
    }
  }
  return sizes.get(src)!;
}

function images(node: Root | Element, out: Element[] = []) {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    if (child.tagName === "img") out.push(child);
    images(child, out);
  }
  return out;
}

export default function rehypePostImages() {
  return (tree: Root) => {
    for (const img of images(tree)) {
      img.properties.loading ??= "lazy";
      const src = img.properties.src;
      if (typeof src !== "string" || !src.startsWith("/") || (img.properties.width && img.properties.height)) continue;
      const { width, height } = sizeOf(src);
      if (width && height) Object.assign(img.properties, { width, height });
    }
  };
}
