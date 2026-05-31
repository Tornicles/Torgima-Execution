import Link from "next/link";
import { PageHero } from "@/components/pages/PageHero";
import { USE_CASES } from "@/lib/use-case-content";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Use Cases — Creators, Solopreneurs, Agencies, Coaches, Startups",
  description: "See how Torgima helps creators, solopreneurs, agency owners, coaches, and founders execute daily toward their goals.",
  path: "/use-cases",
});

export default function UseCasesIndexPage() {
  const cases = Object.values(USE_CASES);
  return (
    <>
      <PageHero title="Built for people who execute." subtitle="Find your path." />
      <section className="section-dark py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((uc) => (
            <Link
              key={uc.slug}
              href={`/use-cases/${uc.slug}`}
              className="glass-card rounded-2xl p-8 hover:border-primary-bright/50 transition-colors"
            >
              <span className="text-3xl">{uc.emoji}</span>
              <h2 className="mt-4 font-syne font-bold text-white">{uc.title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{uc.subtitle}</p>
              <span className="mt-4 inline-block text-sm text-primary-bright font-semibold">Learn more →</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
