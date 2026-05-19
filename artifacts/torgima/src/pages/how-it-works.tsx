import { Link } from "wouter";
import { ArrowRight, Brain, CheckCircle2, GitBranch, Moon, Radio, Shield } from "lucide-react";
import { MarketingLayout, MarketingSection, ProductFrame } from "@/components/marketing/MarketingLayout";
import { useMarketingMetadata } from "@/lib/marketing-metadata";

export default function HowItWorksPage() {
  useMarketingMetadata({
    title: "How Torgima Works",
    description: "See how Torgima turns a goal into a blueprint, tasks, feedback, signals, conditions, and new tasks until the goal is complete.",
    path: "/how-it-works",
  });

  const loop = ["Goal", "Blueprint", "Tasks", "Feedback", "Signals", "Conditions", "New Tasks"];
  const conditions = ["Nothingness", "Stability", "Power", "Affluence", "Urgency", "Danger", "Power Change"];

  return (
    <MarketingLayout>
      <section className="px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#0EA5E9]">How it works</p>
          <h1 className="mt-6 text-5xl font-bold leading-tight tracking-[-0.03em]">A loop that runs until your goal is complete.</h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Torgima is not a static list. It is a structured execution loop: each execution move creates evidence, evidence updates
            signals, and signals shape what the system generates next.
          </p>
        </div>
      </section>

      <MarketingSection title="The execution loop" eyebrow="System architecture">
        <div className="grid gap-3 md:grid-cols-7">
          {loop.map((step, i) => (
            <div key={step} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 text-center">
              <p className="text-xs font-bold text-[#0EA5E9]">0{i + 1}</p>
              <p className="mt-2 text-sm font-bold">{step}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-lg leading-8 text-gray-600">This loop runs during the day and refreshes intelligence overnight.</p>
      </MarketingSection>

      <MarketingSection title="The blueprint" eyebrow="Not a static list">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-7">
            {["Plan: Build the audience engine", "Phase: Proof of value", "Project: Publish weekly proof assets", "Action: Create one artifact", "Execution move: Ship today’s proof-of-work post"].map((item) => (
              <div key={item} className="mb-3 rounded-2xl bg-[#FAFAFA] p-4 text-sm font-medium">
                {item}
              </div>
            ))}
          </div>
          <p className="text-lg leading-8 text-gray-600">
            A blueprint breaks the goal into plans, phases, projects, actions, and tasks. That hierarchy gives Torgima
            enough structure to keep producing the next correct step.
          </p>
        </div>
      </MarketingSection>

      <MarketingSection title="Conditions and signals" eyebrow="Execution reality">
        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6">
          <div className="grid gap-2 md:grid-cols-7">
            {conditions.map((condition) => (
              <div key={condition} className="rounded-2xl bg-[#FAFAFA] p-3 text-center text-xs font-bold">
                {condition}
              </div>
            ))}
          </div>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Torgima measures execution reality, not intentions. Conditions adjust work difficulty, count, and intensity
            based on the signals generated from real feedback.
          </p>
        </div>
      </MarketingSection>

      <MarketingSection title="Bhudhi intelligence" eyebrow="Plain language">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            [Brain, "Validates goals before building"],
            [GitBranch, "Builds blueprints from structured reality checks"],
            [CheckCircle2, "Generates tasks and reads feedback"],
            [Radio, "Reads your industry through EIS"],
            [Moon, "Prepares morning context overnight"],
            [Shield, "Adapts without faking progress"],
          ].map(([Icon, copy]) => (
            <div key={String(copy)} className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-5">
              <Icon className="h-5 w-5 text-[#0EA5E9]" />
              <span className="font-medium">{String(copy)}</span>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <ProductFrame title="Anonymized morning report example" />
        </div>
      </MarketingSection>

      <MarketingSection title="The three laws" eyebrow="Why it is honest">
        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8">
          <p className="text-lg leading-8 text-gray-700">
            Bhudhi interprets and advises. Signals are calculated from real execution data. Bhudhi cannot fake your
            progress. Reality governs the system.
          </p>
        </div>
      </MarketingSection>

      <section className="px-5 py-20 text-center lg:px-8">
        <h2 className="text-4xl font-bold tracking-tight">Ready to start?</h2>
        <Link href="/signup" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0EA5E9] px-7 py-4 font-bold text-white">
          Create your blueprint <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </MarketingLayout>
  );
}
