import type { Metadata } from "next";
import { PageHero } from "@/components/pages/PageHero";
import { FinalCTA } from "@/components/home/FinalCTA";
import { FAQ_CATEGORIES } from "@/lib/faq-data";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Torgima FAQ — Your Questions About the Execution System Answered",
  description: "Answers about idea validation, daily tasks, execution signals, pricing, and how Torgima differs from to-do lists.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <PageHero title="Frequently asked questions" subtitle="Everything you need to know before you validate your idea." />
      <section className="section-light py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6 max-w-3xl space-y-16">
          {FAQ_CATEGORIES.map((cat) => (
            <div key={cat.title}>
              <h2 className="font-syne text-2xl font-bold text-[#18181b]">{cat.title}</h2>
              <dl className="mt-8 space-y-8">
                {cat.items.map((item) => (
                  <div key={item.q}>
                    <dt className="font-semibold text-[#18181b]">{item.q}</dt>
                    <dd className="mt-2 text-zinc-600 leading-relaxed">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
