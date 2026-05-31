import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/pages/PageHero";
import { blogPosts } from "@/lib/blog-data";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Torgima Blog — Execution, Productivity, and Goal Achievement",
  description:
    "Practical guides on execution, habit building, project management, goal setting, and building real businesses.",
  path: "/blog",
});

export default function BlogIndexPage() {
  return (
    <>
      <PageHero title="Execution intelligence" subtitle="Practical guides for builders who execute." />
      <section className="section-dark py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6 space-y-8">
          {blogPosts.map((post) => (
            <article key={post.slug} className="glass-card rounded-2xl p-8 hover:border-primary/30 transition-colors">
              <p className="text-xs font-bold uppercase text-primary-bright">{post.category}</p>
              <Link href={`/blog/${post.slug}`}>
                <h2 className="mt-2 font-syne text-2xl font-bold text-white hover:text-primary-bright">
                  {post.title}
                </h2>
              </Link>
              <p className="mt-3 text-zinc-400">{post.description}</p>
              <p className="mt-4 text-xs text-zinc-600">
                {post.date} · {post.readMins} min read
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
