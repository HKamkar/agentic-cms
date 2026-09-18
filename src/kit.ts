// The engine composed for this site: the one file the app and the CLI read
// the collections, the posts and the SEO from. Server code only (the engine
// reads node:fs); a client component gets what it needs as props.
import { sectionSchema } from "@/components/sections/schemas";
import { site } from "@/config/site";
import { createKit } from "agentic-cms";

export const kit = createKit({ site, sections: sectionSchema });
