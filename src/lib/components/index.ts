// The React pieces of the engine that carry no design: structured data, an
// above-the-fold image that stays out of the RSC preload hints, the post
// body's FAQ accordion behaviour, an e-mail address as a link that is never
// text in a served file, and an icon from path data. A site styles around them.
export { JsonLd } from "./JsonLd.tsx";
export { EagerImage } from "./EagerImage.tsx";
export { FaqAccordion } from "./FaqAccordion.tsx";
export { EmailLink } from "./EmailLink.tsx";
export { Icon, type IconData } from "./Icon.tsx";
