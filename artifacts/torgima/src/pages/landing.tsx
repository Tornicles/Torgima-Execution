import { Link } from "wouter";
import { ArrowRight, Brain, ClipboardList, Moon, Target } from "lucide-react";
import { MarketingLayout, MarketingSection, ProductFrame } from "@/components/marketing/MarketingLayout";
import { useMarketingMetadata } from "@/lib/marketing-metadata";

export default function LandingPage() {
  useMarketingMetadata({
    title: "Torgima",
    path: "/",
  });

  return (
    <MarketingLayout>
      <section className="px-5 py-24 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#0EA5E9]">Execution operating system</p>
            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-[-0.04em] text-[#0A0F1E] sm:text-6xl lg:text-7xl">
              The execution system that never stops working for you.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              Enter a goal. Get a blueprint. Torgima generates your next task, and the one after that, until your goal
              is complete. Even while you sleep.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0EA5E9] px-7 py-4 font-bold text-white hover:bg-sky-600">
                Start Your Blueprint <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/how-it-works" className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-7 py-4 font-bold text-[#0A0F1E] hover:bg-gray-50">
                See how it works
              </Link>
            </div>
          </div>
          <ProductFrame />
        </div>
      </section>

      <MarketingSection title="Most goals fail because ambition stops becoming action." eyebrow="The problem">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["Plan overwhelm", "The goal becomes a pile of possible work instead of one correct next step."],
            ["Execution gap", "People know what they want, but not what today’s concrete move should be."],
            ["Empty accountability", "A task list records intention. It does not adapt when reality changes."],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-3xl border border-[#E5E7EB] bg-white p-7">
              <p className="text-lg font-bold">{title}</p>
              <p className="mt-3 text-sm leading-6 text-gray-600">{copy}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="How Torgima works" eyebrow="Three steps">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            [Target, "Enter your goal", "Give Torgima the outcome, timeframe, and reason. It checks reality before structure."],
            [ClipboardList, "Get your blueprint", "The system turns the goal into plans, phases, projects, actions, and tasks."],
            [Moon, "Wake up with context", "Your next task is always ready, with intelligence refreshed overnight when enabled."],
          ].map(([Icon, title, copy]) => (
            <div key={String(title)} className="rounded-3xl border border-[#E5E7EB] bg-white p-7">
              <Icon className="h-6 w-6 text-[#0EA5E9]" />
              <p className="mt-5 text-lg font-bold">{String(title)}</p>
              <p className="mt-3 text-sm leading-6 text-gray-600">{String(copy)}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="While you sleep, Torgima reads your industry." eyebrow="Overnight intelligence">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-lg leading-8 text-gray-600">
              When you wake up, your morning report shows competitor gaps, platform signals, trend velocity, and the
              execution context that matters for today’s task.
            </p>
            <Link href="/pricing" className="mt-8 inline-flex rounded-full bg-[#0A0F1E] px-6 py-3 text-sm font-bold text-white">
              See full pricing
            </Link>
          </div>
          <ProductFrame title="Morning report screenshot" />
        </div>
      </MarketingSection>

      <MarketingSection title="What Torgima is not" eyebrow="Positioning">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["Not a task manager", "It is a system that keeps turning a goal into the next correct task."],
            ["Not an AI chatbot", "It is a controlled execution intelligence governed by real signals."],
            ["Not a planner", "It is a loop that adapts after each task, report, and condition change."],
          ].map(([not, is]) => (
            <div key={not} className="rounded-3xl border border-[#E5E7EB] bg-white p-7">
              <p className="text-sm text-gray-400 line-through">{not}</p>
              <p className="mt-3 text-lg font-bold text-[#0EA5E9]">It is:</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">{is}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="Bhudhi is the intelligence layer behind Torgima." eyebrow="The intelligence layer">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            "Validates goals against execution reality",
            "Builds structured blueprints",
            "Generates the next task continuously",
            "Reads market and platform context overnight",
            "Detects burnout and capability gaps",
            "Surfaces strategic outlook and signal narratives",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-5">
              <Brain className="h-5 w-5 text-[#F59E0B]" />
              <span className="font-medium">{feature}</span>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="Free to execute. Upgrade when you want the full intelligence layer." eyebrow="Pricing preview">
        <div className="grid gap-5 md:grid-cols-2">
          {[
            ["Execution", "Free", "Goal validation, blueprints, tasks, feedback, signals, conditions, Academy, and dashboard basics."],
            ["Intelligence", "TBD", "Everything in free, plus overnight intelligence, morning reports, strategic outlook, and full signal history."],
          ].map(([name, price, copy]) => (
            <div key={name} className="rounded-3xl border border-[#E5E7EB] bg-white p-8">
              <p className="text-2xl font-bold">{name}</p>
              <p className="mt-4 text-4xl font-black">{price}</p>
              <p className="mt-4 text-sm leading-6 text-gray-600">{copy}</p>
            </div>
          ))}
        </div>
        <Link href="/pricing" className="mt-8 inline-flex rounded-full bg-[#0EA5E9] px-6 py-3 text-sm font-bold text-white">
          See full pricing
        </Link>
      </MarketingSection>

      <section className="px-5 py-20 text-center lg:px-8">
        <h2 className="text-4xl font-bold tracking-tight">Start with one blueprint.</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-gray-600">
          Create an account, enter your goal, and let Torgima build the execution structure.
        </p>
        <Link href="/signup" className="mt-8 inline-flex rounded-full bg-[#0EA5E9] px-7 py-4 font-bold text-white">
          Start Your Blueprint
        </Link>
      </section>
    </MarketingLayout>
  );
}
