"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

/** One button, three states: the reader's system setting, then light, then dark, then back. */
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

/**
 * The theme switch. "system" means no attribute at all, so `color-scheme:
 * light dark` follows the operating system; a choice writes `data-theme` on
 * <html> (which the inline script in the layout replays before the first
 * paint) and remembers it.
 *
 * The attribute is the state — the button reads it rather than keeping a copy,
 * so the server renders "system" and the first client render agrees with it,
 * then the real value arrives without a flash of the wrong label.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, readOnServer);
  const cycle = () => {
    apply(NEXT[theme]);
    listeners.forEach((listener) => listener());
  };

  return (
    <button type="button" onClick={cycle} className="border border-ink px-3 py-1 font-label text-h6">
      {`Theme: ${theme}`}
    </button>
  );
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function read(): Theme {
  const applied = document.documentElement.getAttribute("data-theme");
  return applied === "light" || applied === "dark" ? applied : "system";
}

function readOnServer(): Theme {
  return "system";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {
    // A private window can refuse storage; the choice then lasts the page only.
  }
}
