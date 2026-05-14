import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogPosts } from "@/lib/blog-data";

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const post = blogPosts.find((p) => p.slug === params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: `Read on Torgima — ${post.category}.`,
  };
}

export default function BlogPostPage({ params }: Props) {
  const post = blogPosts.find((p) => p.slug === params.slug);
  if (!post) notFound();

  return (
    <article className="py-section-sm lg:py-section px-4 max-w-content mx-auto">
      <Link href="/blog" className="font-dm text-sm text-[var(--color-accent-blue)] hover:underline focus-ring rounded-sm mb-8 inline-block">
        ← Blog
      </Link>
      <p className="font-jet text-[11px] uppercase tracking-wider text-[var(--color-accent-blue)] mb-3">{post.category}</p>
      <h1 className="font-syne font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text-primary)]">{post.title}</h1>
      <div className="mt-4 flex gap-2 font-dm text-sm text-[var(--color-text-muted)]">
        <time dateTime={post.date}>{post.date}</time>
        <span>·</span>
        <span>{post.readMins} min read</span>
      </div>
      <div className="mt-12 space-y-6 font-dm text-[var(--color-text-secondary)] leading-relaxed">
        <p className="first-letter:text-3xl first-letter:font-syne first-letter:font-bold first-letter:text-[var(--color-text-primary)]">
          This is placeholder editorial content for the live site. Replace with your full article. The core idea: execution beats
          intent when the system is honest about progress and next actions.
        </p>
        <p>
          Torgima treats your goal as input to a blueprint, not a slogan. Tasks exist because the map says they should — not because
          a model guessed in isolation.
        </p>
        <p>
          Signals exist to keep the map aligned with reality. When you slip, the load changes. When you surge, depth increases. The
          interface stays calm; the control law does the work.
        </p>
      </div>
    </article>
  );
}
