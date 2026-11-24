// Every page that is a file (content/pages/<slug>.yaml) renders here — the
// home page included (the optional catch-all matches "/" with no slug): the
// head from its seo block, its structured data and breadcrumb, then its
// sections through the registry. Only the paths the page files declare are
// built (dynamicParams = false); anything else is the 404 page. A static
// route file (src/app/<route>/page.tsx, such as the blog posts') wins over
// this one. A language of site.locales has its own copy of this file in
// src/app/<prefix>/[[...slug]]/, with LOCALE its tag (docs/locales.md).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "agentic-cms/components";
import { renderSections } from "@/components/sections/render";
import { kit } from "@/kit";

type Props = { params: Promise<{ slug?: string[] }> };

const LOCALE = kit.locales.default.locale;
const pages = () => kit.content.in(LOCALE).getPages();

export const dynamicParams = false;

// A page's slug is its path without the language's prefix: /de/about is ["about"] under src/app/de/.
export function generateStaticParams() {
  return pages().map((entry) => ({ slug: kit.locales.unprefixed(entry.data.seo.path).split("/").filter(Boolean) }));
}

const pageAt = (slug: string[] | undefined) => pages().find((entry) => entry.data.seo.path === kit.locales.path(LOCALE, `/${(slug ?? []).join("/")}`))?.data;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageAt((await params).slug);
  return page ? kit.seo.pageMetadata(page.seo) : {};
}

export default async function ContentPage({ params }: Props) {
  const page = pageAt((await params).slug);
  if (!page) notFound();
  return (
    <>
      <JsonLd data={kit.seo.pageJsonLd(page)} />
      {page.seo.path !== "/" && <JsonLd data={kit.seo.pageBreadcrumb(page.seo)} />}
      {renderSections(page.sections, LOCALE)}
    </>
  );
}
