import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { UseCasePage } from "@/components/pages/UseCasePage";
import { USE_CASES } from "@/lib/use-case-content";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return Object.keys(USE_CASES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = USE_CASES[slug];
  if (!data) return {};
  return pageMetadata({
    title: data.seo.title,
    description: data.seo.description,
    keywords: data.seo.keywords,
    path: `/use-cases/${slug}`,
  });
}

export default async function UseCaseSlugPage({ params }: Props) {
  const { slug } = await params;
  const data = USE_CASES[slug];
  if (!data) notFound();
  return <UseCasePage data={data} />;
}
