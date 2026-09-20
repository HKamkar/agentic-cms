// An e-mail address that never appears as text in a served file. Not secrecy
// — a scraper that runs scripts sees the link — but the address is out of
// reach of the harvesters that read HTML, RSC payloads, feeds and bundles as
// text, which is where an inbox's spam comes from. The token is the address
// reversed and base64-encoded: trivially reversible on purpose, and never
// containing an `@`, which is how the form backend and the link tell a token
// from an address. Plain TypeScript, no React: usable from server code, from
// the command line and from a client component alike.

const reverse = (s: string) => [...s].reverse().join("");

/** The token for an address. */
export const encodeEmail = (address: string): string => btoa(reverse(address));

/** The address behind a token. */
export const decodeEmail = (token: string): string => reverse(atob(token));

/** Whether a string is a token rather than an address (a token has no `@`). */
export const isEmailToken = (value: string): boolean => value.length > 0 && !value.includes("@") && /^[A-Za-z0-9+/]+=*$/.test(value);

/** The address spelled for a page before hydration: `hello [at] acme [dot] example`. */
export const readableEmail = (address: string): string => address.replace("@", " [at] ").replace(/\.(?=[^.]*$)/, " [dot] ");
