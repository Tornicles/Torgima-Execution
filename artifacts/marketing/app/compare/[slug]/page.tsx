import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHero } from "@/components/pages/PageHero";
import { CompareTable } from "@/components/pages/CompareTable";
import { FinalCTA } from "@/components/home/FinalCTA";
import { COMPARE_PAGES } from "@/lib/compare-data";
import { pageMetadata } from "@/lib/seo";

const SLUG_MAP: Record<string, keyof typeof COMPARE_PAGES> = {
  "torgima-vs-notion": "notion",
  "torgima-vs-clickup": "clickup",
  "torgima-vs-asana": "asana",
  "torgima-vs-todoist": "todoist",
};

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return Object.keys(SLUG_MAP).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const key = SLUG_MAP[slug];
  const data = key ? COMPARE_PAGES[key] : null;
  if (!data) return {};
  return pageMetadata({
    title: data.seo.title,
    description: data.seo.description,
    keywords: data.seo.keywords,
    path: `/compare/${slug}`,
  });
}

export default async function CompareSlugPage({ params }: Props) {
  const { slug } = await params;
  const key = SLUG_MAP[slug];
  const data = key ? COMPARE_PAGES[key] : null;
  if (!data) notFound();

  return (
    <>
      <PageHero title={data.title} subtitle={data.subtitle} />
      <section className="section-dark py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <CompareTable competitor={data.competitor} rows={data.rows} />
          <p className="mt-8 text-zinc-400 text-center max-w-2xl mx-auto">
            {data.competitor} is excellent at what it was built for. Torgima was built for a different
            job: making you execute your goal every single day with intelligence that adapts to reality.
          </p>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
