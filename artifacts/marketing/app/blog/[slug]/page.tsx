import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { blogPosts } from "@/lib/blog-data";
import { pageMetadata } from "@/lib/seo";
import { FinalCTA } from "@/components/home/FinalCTA";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${slug}`,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) notFound();

  return (
    <>
      <article className="mesh-bg py-16 sm:py-24">
        <div className="mx-auto max-w-content px-4 sm:px-6 max-w-3xl">
          <Link href="/blog" className="text-sm text-primary-bright hover:underline">
            ← Blog
          </Link>
          <p className="mt-6 text-xs font-bold uppercase text-primary-bright">{post.category}</p>
          <h1 className="mt-4 font-syne text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {post.title}
          </h1>
          <p className="mt-4 text-zinc-500 text-sm">
            {post.date} · {post.readMins} min read
          </p>
          <div className="mt-10 space-y-6 text-zinc-300 leading-relaxed">
            {post.content.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </article>
      <FinalCTA />
    </>
  );
}
