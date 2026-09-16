// Every page that is a file (content/pages/<slug>.yaml) renders here — the
// home page included (the optional catch-all matches "/" with no slug): the
// head from its seo block, its structured data and breadcrumb, then its
// sections through the registry. Only the paths the page files declare are
// built (dynamicParams = false); anything else is the 404 page. A static
// route file (src/app/<route>/page.tsx, such as the blog posts') wins over
// this one.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { renderSections } from "@/components/sections/render";
import { getPages } from "@/lib/content";
import { pageBreadcrumb } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { pageJsonLd } from "@/lib/seo/pageJsonLd";

type Props = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getPages().map((entry) => ({ slug: entry.data.seo.path === "/" ? [] : entry.data.seo.path.slice(1).split("/") }));
}

const pageAt = (slug: string[] | undefined) => getPages().find((entry) => entry.data.seo.path === `/${(slug ?? []).join("/")}`)?.data;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageAt((await params).slug);
  return page ? pageMetadata(page.seo) : {};
}

export default async function ContentPage({ params }: Props) {
  const page = pageAt((await params).slug);
  if (!page) notFound();
  return (
    <>
      <JsonLd data={pageJsonLd(page)} />
      {page.seo.path !== "/" && <JsonLd data={pageBreadcrumb(page.seo)} />}
      {renderSections(page.sections)}
    </>
  );
}
