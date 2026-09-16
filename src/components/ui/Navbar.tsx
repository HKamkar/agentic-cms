"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { NavLink } from "@/components/ui/NavLink";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { site } from "@/config/site";

const DESKTOP = "(min-width: 992px)";
const MENU_ID = "mobile-menu";

function NavItems() {
  return (
    <>
      {site.nav.map((entry) => (
        <li key={entry.label}>
          <NavLink href={entry.href} label={entry.label} />
        </li>
      ))}
    </>
  );
}

/** Closes the open menu on any click that lands outside the panel (the button toggles it itself). */
function useCloseOnOutsideClick(open: boolean, menu: RefObject<HTMLElement | null>, button: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onClick = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open, menu, button, close]);
}

/** The keyboard model of the open menu: Escape closes it and hands focus back to the button; arrows, Home and End walk the links. */
function handleMenuKey(e: KeyboardEvent, menu: HTMLElement | null, button: HTMLElement | null, close: () => void) {
  const links = Array.from(menu?.querySelectorAll<HTMLElement>("a[href]") ?? []);
  const index = links.indexOf(document.activeElement as HTMLElement);
  const focus = (i: number) => links[Math.max(0, Math.min(links.length - 1, i))]?.focus();
  const moves: Record<string, () => void> = {
    // Focus first: the panel is unmounted by close(), and focus would land on <body>.
    Escape: () => {
      button?.focus();
      close();
    },
    ArrowDown: () => focus(index + 1),
    ArrowRight: () => focus(index + 1),
    ArrowUp: () => focus(index - 1),
    ArrowLeft: () => focus(index - 1),
    Home: () => focus(0),
    End: () => focus(links.length - 1),
  };
  const move = moves[e.key];
  if (!move) return;
  e.preventDefault();
  move();
}

/** The sign-in link, the call to action and the theme switch: the bar shows them beside the links, the menu under them. */
function Actions() {
  return (
    <>
      <a href={site.signIn.href} target="_blank" rel="noopener noreferrer">
        {site.signIn.label}
      </a>
      <Button href={site.cta.href} label={site.cta.label} variant="outline" />
      <ThemeToggle />
    </>
  );
}

/** The site header: the brand, the page links, the actions, and below 992px a menu button that discloses all of them. */
export function Navbar() {
  const pathname = usePathname();
  // The state is the page the menu was opened on, so a navigation closes it by
  // itself: no effect watches the route, and the menu never outlives its page.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpenedOn(null), []);

  // It does not outlive the collapsed layout either: past 992px the bar itself
  // shows everything the menu holds.
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP);
    const onChange = () => mql.matches && close();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [close]);
  useCloseOnOutsideClick(open, menuRef, buttonRef, close);

  // Any link in the menu closes it (next/link navigates without a reload).
  const onMenuClick = (e: MouseEvent) => (e.target as Element).closest("a") && close();
  const onKeyDown = (e: KeyboardEvent) => open && handleMenuKey(e, menuRef.current, buttonRef.current, close);

  return (
    <header className="border-b border-ink bg-paper" onKeyDown={onKeyDown}>
      <Container>
        <div className="flex items-center justify-between gap-4 py-3">
          <NavLink href="/" label={site.shortName} className="font-semibold no-underline" />
          <nav aria-label="Main" className="max-lg:hidden">
            <ul className="flex gap-4">
              <NavItems />
            </ul>
          </nav>
          <div className="flex items-center gap-3 max-lg:hidden">
            <Actions />
          </div>
          <button ref={buttonRef} type="button" className="border border-ink px-3 py-1 lg:hidden" aria-expanded={open} aria-controls={MENU_ID} onClick={() => setOpenedOn(open ? null : pathname)}>
            Menu
          </button>
        </div>
      </Container>
      {open && (
        <div ref={menuRef} id={MENU_ID} className="border-t border-ink lg:hidden" onClick={onMenuClick}>
          <Container>
            <ul className="flex flex-col gap-3 py-4">
              <NavItems />
            </ul>
            <div className="flex flex-wrap items-center gap-3 pb-4">
              <Actions />
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
