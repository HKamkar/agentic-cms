import Link from "next/link";
import { BlogHero } from "@/components/blog/BlogHero";
import { chrome } from "@/config/site";

export default function NotFound() {
  const { label, title, text } = chrome.notFound;
  return (
    <BlogHero type="not-found" label={label} title={title}>
      <p>{text.map((part) => (typeof part === "string" ? part : <Link key={part.href} href={part.href}>{part.label}</Link>))}</p>
    </BlogHero>
  );
}
