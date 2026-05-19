import { MarketingLayout, MarketingSection } from "@/components/marketing/MarketingLayout";
import { useMarketingMetadata } from "@/lib/marketing-metadata";

export default function ChangelogPage() {
  useMarketingMetadata({
    title: "Changelog",
    description: "Transparent Torgima build history, including Phase 1: the individual execution system.",
    path: "/changelog",
  });

  return (
    <MarketingLayout>
      <section className="px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#0EA5E9]">Build history</p>
          <h1 className="mt-6 text-5xl font-bold tracking-[-0.03em]">Torgima changelog</h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Honest notes on what shipped and what is next. No hard dates for future phases.
          </p>
        </div>
      </section>

      <MarketingSection title="Phase 1 — Individual Execution System" eyebrow="May 2026">
        <article className="rounded-3xl border border-[#E5E7EB] bg-white p-8">
          <p className="text-sm font-bold uppercase tracking-wider text-[#F59E0B]">Phase 1 complete</p>
          <ul className="mt-6 grid gap-3 text-sm leading-6 text-gray-700 md:grid-cols-2">
            {[
              "Goal validation with reality checks",
              "Execution blueprint generation",
              "Continuous task loop",
              "7 execution conditions with adaptive control",
              "Academy and capability development",
              "Overnight intelligence for paid tier",
              "Morning Intelligence Report",
              "Dashboard intelligence panels",
            ].map((item) => (
              <li key={item} className="rounded-2xl bg-[#FAFAFA] p-4">{item}</li>
            ))}
          </ul>
          <p className="mt-8 text-sm leading-6 text-gray-600">
            Next: Phase 2 — Psychological Civilization is the roadmap direction and begins after real user data is available.
          </p>
        </article>
      </MarketingSection>
    </MarketingLayout>
  );
}
