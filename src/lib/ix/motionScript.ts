// The inline script that arms the play-once layer for this page view, before
// the first paint: it sets data-motion="on" on <html> unless the reader
// prefers reduced motion. The layer's start states in the site's motion.css
// all require that attribute, so a page that never gets it — scripts off,
// reduced motion, a crawler, the harness's static captures — shows every
// part where it ends. A site renders it as an inline script near the top of <body>
// (<html> carries suppressHydrationWarning, as it does for the theme script).

/** The arming script's text: `<script dangerouslySetInnerHTML={{ __html: motionScript() }} />`. */
export function motionScript(): string {
  return "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.setAttribute('data-motion','on')}catch(e){}";
}
