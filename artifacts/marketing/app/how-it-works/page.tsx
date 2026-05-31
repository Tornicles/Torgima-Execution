import type { Metadata } from "next";
import { PageHero } from "@/components/pages/PageHero";
import { DashboardMockup } from "@/components/shared/DashboardMockup";
import { FinalCTA } from "@/components/home/FinalCTA";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "How Torgima Works — From Idea to Daily Execution in Minutes",
  description:
    "Learn exactly how Torgima works. Validate your idea, launch your project, execute 8 daily tasks, submit feedback, and watch the system adapt automatically.",
  path: "/how-it-works",
});

const STEPS = [
  {
    n: 1,
    title: "Validate Your Idea",
    time: "2 minutes",
    body: `Enter your goal and purpose. The Idea Validator runs 12 stages: market analysis, competitor identification, opportunity mapping, economic context, execution readiness, and your Idea Strength Score. You receive a verdict — Go For It, Adjust Then Go, or Consider a Different Angle — plus three optimized paths.`,
    mock: "validator" as const,
  },
  {
    n: 2,
    title: "Name and Launch Your Project",
    time: "30 seconds",
    body: `Name your project and select your path. On launch, Torgima builds your complete hierarchy — Foundation through Scale, stages, sprints, steps — and generates your first 8 tasks. You start in Getting Started state with easy, achievable work.`,
    mock: "dashboard" as const,
  },
  {
    n: 3,
    title: "Execute Your 8 Daily Tasks",
    body: `Each task includes a title, instruction, definition of done, why it matters, and time estimate. Start the task, do the work, mark completion status. If blocked, report it — the system responds with recovery or clarification tasks.`,
    mock: "tasks" as const,
  },
  {
    n: 4,
    title: "Submit Feedback",
    body: `After each task, rate how it went, describe what happened, and note blockers. Short or dishonest feedback triggers a quick clarification question. Your feedback directly shapes tomorrow's tasks.`,
    mock: "tasks" as const,
  },
  {
    n: 5,
    title: "The System Adapts and Continues",
    body: `Signals update from your feedback. Your execution state controls task count and difficulty. Strong execution unlocks harder work. Needs Attention triggers recovery. Bhudhi never stops generating your next steps until the project is complete.`,
    mock: "dashboard" as const,
  },
];

const FAQ = [
  { q: "How many tasks do I get per day?", a: "Up to 8, depending on your plan and execution state. Getting Started may be 1-3; Peak Performance up to 8." },
  { q: "What if I can't complete all 8?", a: "Submit honest feedback on what you did. The system adapts tomorrow's count." },
  { q: "Can I customize tasks?", a: "Tasks are generated for your goal and state. Feedback shapes future tasks — not manual editing." },
  { q: "What happens if I miss a day?", a: "Streak resets. State may shift to recovery with easier tasks." },
  { q: "How is this different from a to-do list?", a: "Torgima tells you what to do, why, and adapts based on performance. Lists just store what you type." },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero title="How Torgima works" subtitle="From idea to daily execution in under 5 minutes." />
      <section className="section-dark py-20 space-y-24">
        {STEPS.map((s, i) => (
          <div key={s.n} className="mx-auto max-w-content px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
            <div className={i % 2 === 1 ? "lg:order-2" : ""}>
              <p className="font-jet text-primary-bright">
                Step {s.n}
                {s.time ? ` · ${s.time}` : ""}
              </p>
              <h2 className="mt-2 font-syne text-3xl font-bold text-white">{s.title}</h2>
              <p className="mt-4 text-zinc-400 leading-relaxed">{s.body}</p>
            </div>
            <div className={i % 2 === 1 ? "lg:order-1" : ""}>
              <DashboardMockup variant={s.mock} />
            </div>
          </div>
        ))}
      </section>
      <section className="section-light py-20">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <h2 className="font-syne text-3xl font-bold">Common questions</h2>
          <dl className="mt-10 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold text-[#18181b]">{item.q}</dt>
                <dd className="mt-2 text-zinc-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
