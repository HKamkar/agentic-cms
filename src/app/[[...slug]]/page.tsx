// Every page that is a file (content/pages/<slug>.yaml) renders here — the
// home page included (the optional catch-all matches "/" with no slug): the
// head from its seo block, its structured data and breadcrumb, then its
// sections through the registry. Only the paths the page files declare are
// built (dynamicParams = false); anything else is the 404 page. A static
// route file (src/app/<route>/page.tsx, such as the blog posts') wins over
// this one.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/lib/components";
import { renderSections } from "@/components/sections/render";
import { kit } from "@/kit";

type Props = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return kit.content.getPages().map((entry) => ({ slug: entry.data.seo.path === "/" ? [] : entry.data.seo.path.slice(1).split("/") }));
}

const pageAt = (slug: string[] | undefined) => kit.content.getPages().find((entry) => entry.data.seo.path === `/${(slug ?? []).join("/")}`)?.data;

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
      {renderSections(page.sections)}
    </>
  );
}
