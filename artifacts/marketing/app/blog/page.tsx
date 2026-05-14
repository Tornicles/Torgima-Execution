import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts } from "@/lib/blog-data";

export const metadata: Metadata = {
  title: "Execution Intelligence",
  description: "Thinking on goals, systems, and what it takes to finish.",
};

export default function BlogIndexPage() {
  return (
    <div className="py-section-sm lg:py-section px-4 max-w-5xl mx-auto">
      <header className="max-w-2xl mb-16">
        <p className="font-jet text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent-blue)] mb-3">Blog</p>
        <h1 className="font-syne font-extrabold text-4xl sm:text-5xl text-[var(--color-text-primary)]">
          Execution Intelligence
        </h1>
        <p className="mt-4 font-dm text-lg text-[var(--color-text-secondary)]">
          Thinking on goals, systems, and what it takes to finish.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-6">
        {blogPosts.map((post) => (
          <article
            key={post.slug}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 hover:border-[var(--color-border-hover)] hover:-translate-y-0.5 transition-all duration-200"
          >
            <span className="font-jet text-[10px] uppercase tracking-wider text-[var(--color-accent-blue)]">{post.category}</span>
            <h2 className="mt-3 font-syne font-bold text-xl text-[var(--color-text-primary)]">
              <Link href={`/blog/${post.slug}`} className="hover:text-[var(--color-accent-blue)] focus-ring rounded-sm">
                {post.title}
              </Link>
            </h2>
            <div className="mt-4 flex gap-2 font-dm text-xs text-[var(--color-text-muted)]">
              <time dateTime={post.date}>{post.date}</time>
              <span>·</span>
              <span>{post.readMins} min read</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
