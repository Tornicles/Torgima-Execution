import { Link } from "wouter";
import { MarketingLayout, MarketingSection } from "@/components/marketing/MarketingLayout";
import { useMarketingMetadata } from "@/lib/marketing-metadata";

export default function AboutPage() {
  useMarketingMetadata({
    title: "About Torgima",
    description: "The manifesto behind Torgima: an execution operating system built on reality, signals, blueprints, and honest intelligence.",
    path: "/about",
  });

  return (
    <MarketingLayout>
      <section className="px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#0EA5E9]">Manifesto</p>
          <h1 className="mt-6 text-5xl font-bold tracking-[-0.03em]">Execution is the only thing that matters.</h1>
        </div>
      </section>

      <MarketingSection title="The belief system behind Torgima">
        <div className="mx-auto max-w-3xl space-y-8 text-lg leading-9 text-gray-700">
          <p>
            Most people have goals. Almost no one has an execution system. The distance between knowing what you want
            and consistently doing what is needed to get there is where most dreams end.
          </p>
          <p>
            Torgima is not a planner. Not a motivational tool. It is an execution operating system. It converts your
            goal into the next correct move, and the one after that, until the goal is complete. It measures your
            reality. It adapts to your behavior. It works while you sleep.
          </p>
          <p>
            The intelligence layer behind Torgima does not tell you what you want to hear. It reads your execution
            signals, not your intentions. It cannot fake your progress. Reality governs the system.
          </p>
          <p>
            Torgima is built on one principle: the only thing that converts goals into reality is execution. Everything
            else is preparation.
          </p>
        </div>
      </MarketingSection>

      <MarketingSection title="Built for operators, not browsers" eyebrow="Built by">
        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8">
          <p className="text-lg leading-8 text-gray-700">
            Torgima is product-focused by design: less performance theater, more continuity. The system exists to keep
            converting your intent into verifiable work.
          </p>
        </div>
      </MarketingSection>

      <section className="px-5 py-20 text-center lg:px-8">
        <Link href="/signup" className="inline-flex rounded-full bg-[#0EA5E9] px-7 py-4 font-bold text-white">
          Start your first blueprint
        </Link>
      </section>
    </MarketingLayout>
  );
}
