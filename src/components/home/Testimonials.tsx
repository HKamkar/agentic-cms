import type { SectionProps } from "@/components/sections/schemas";
import { Section } from "@/components/ui/Section";
import type { Review } from "content-engine-kit/content";

const card = "flex flex-col gap-2 border border-ink p-4";

/** The reviews of the review collection, one card each: the portrait, the quote, the name and the role. */
export function Testimonials({ eyebrow, heading, reviews }: SectionProps<"reviews"> & { reviews: Review[] }) {
  return (
    <Section type="reviews" eyebrow={eyebrow} heading={heading}>
      <ul className="grid gap-4 lg:grid-cols-3">
        {reviews.map((review) => (
          <li key={review.name} className={card}>
            <img src={review.photo} width={80} height={80} alt={review.photoAlt ?? ""} loading="lazy" className="size-20 border border-ink" />
            <blockquote>
              <p>{review.quote}</p>
            </blockquote>
            <p className="font-medium">{review.name}</p>
            <p className="text-muted">{review.role}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
