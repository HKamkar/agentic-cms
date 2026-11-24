import Link from "next/link";
import { BlogHero } from "@/components/blog/BlogHero";
import { copyFor, site } from "@/config/site";

// The default language's 404: a path no page answers has no language of its own.
export default function NotFound() {
  const { label, title, text } = copyFor(site.locale).chrome.notFound;
  return (
    <BlogHero type="not-found" label={label} title={title}>
      <p>{text.map((part) => (typeof part === "string" ? part : <Link key={part.href} href={part.href}>{part.label}</Link>))}</p>
    </BlogHero>
  );
}
