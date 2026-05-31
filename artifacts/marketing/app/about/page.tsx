import type { Metadata } from "next";
import { PageHero } from "@/components/pages/PageHero";
import { FinalCTA } from "@/components/home/FinalCTA";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About Torgima — The Story Behind the Execution System",
  description:
    "Torgima was built because planning is not the problem — execution is. Learn our mission and what drives every product decision.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <PageHero title="We built Torgima because planning was never the problem." />
      <section className="section-light py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6 max-w-3xl prose prose-zinc">
          <h2 className="font-syne text-2xl font-bold text-[#18181b]">Origin</h2>
          <p className="mt-4 text-zinc-600 leading-relaxed">
            Most people who fail at their goals do not fail because they did not plan. They fail because
            nothing held them accountable to executing the plan. Nothing adapted when they had a bad day.
            Nothing told them which of their forty tasks actually mattered today.
          </p>
          <p className="mt-4 text-zinc-600 leading-relaxed">
            We built Torgima to be that system. Not a place to store your plans. An engine that drives
            execution.
          </p>
          <h2 className="font-syne text-2xl font-bold text-[#18181b] mt-12">Mission</h2>
          <p className="mt-4 text-zinc-600 leading-relaxed">
            Give every builder, creator, and founder the execution system that makes the gap between idea
            and reality as short as possible.
          </p>
          <h2 className="font-syne text-2xl font-bold text-[#18181b] mt-12">What we believe</h2>
          <ul className="mt-4 space-y-2 text-zinc-600 list-disc pl-6">
            <li>Plans are worthless without execution</li>
            <li>Real accountability requires real intelligence</li>
            <li>Daily actions should always connect back to your goal</li>
            <li>A system that doesn&apos;t adapt to reality will always fail</li>
            <li>Execution is a skill that can be measured and improved</li>
          </ul>
          <h2 className="font-syne text-2xl font-bold text-[#18181b] mt-12">How we&apos;re different</h2>
          <p className="mt-4 text-zinc-600 leading-relaxed">
            Every other productivity tool was built to organize information. Torgima was built to drive
            behavior. There is a fundamental difference between a system that shows you your tasks and a
            system that tells you exactly which task to do right now, why it matters, and how well you
            executed it.
          </p>
          <h2 className="font-syne text-2xl font-bold text-[#18181b] mt-12">Bhudhi</h2>
          <p className="mt-4 text-zinc-600 leading-relaxed">
            Bhudhi is not a chatbot you talk to. It is execution intelligence embedded in your project. It
            knows your goal, your history, and your signals. It cannot lie to you about your progress.
            That is by design.
          </p>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
