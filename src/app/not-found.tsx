import Link from "next/link";
import { BlogHero } from "@/components/blog/BlogHero";
import { site } from "@/config/site";

export default function NotFound() {
  return (
    <BlogHero type="not-found" label="404" title="We couldn't find that page.">
      <p>
        The page may have moved. <Link href={site.links.blog}>Browse the latest posts</Link> or head <Link href="/">home</Link>.
      </p>
    </BlogHero>
  );
}
