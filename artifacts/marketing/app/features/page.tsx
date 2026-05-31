import type { Metadata } from "next";
import { PageHero } from "@/components/pages/PageHero";
import { DashboardMockup } from "@/components/shared/DashboardMockup";
import { FinalCTA } from "@/components/home/FinalCTA";
import { pageMetadata } from "@/lib/seo";
import { DETAILED_FEATURES } from "@/lib/features-content";

export const metadata: Metadata = pageMetadata({
  title: "Torgima Features — Intelligent Task Management, Habit Tracking & Execution System",
  description:
    "Torgima replaces your habit tracker, project management app, daily planner, workflow tool, and accountability system. One intelligent execution platform with AI-powered task generation, signal tracking, and adaptive execution.",
  keywords: [
    "task manager features",
    "habit tracker app",
    "project management features",
    "daily planner features",
    "productivity app features",
    "AI task manager",
    "workflow automation tool",
    "execution system",
    "goal tracking app",
    "daily agenda app",
  ],
  path: "/features",
});

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything you need to execute. Nothing you don't."
        subtitle="Replace your habit tracker, project manager, daily planner, and accountability system with one intelligent machine."
      />
      <section className="section-dark py-16 space-y-32">
        {DETAILED_FEATURES.map((f, i) => (
          <div key={f.id} className="mx-auto max-w-content px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <h2 className="font-syne text-3xl font-bold text-white">{f.title}</h2>
                <p className="mt-4 text-zinc-400 leading-relaxed whitespace-pre-line">{f.body}</p>
                <ul className="mt-6 space-y-2">
                  {f.benefits.map((b) => (
                    <li key={b} className="text-sm text-zinc-300 flex gap-2">
                      <span className="text-emerald-400">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm text-primary-bright">
                  <span className="text-zinc-500">Built for: </span>
                  {f.whoFor}
                </p>
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                <DashboardMockup variant={f.mock} />
              </div>
            </div>
          </div>
        ))}
      </section>
      <FinalCTA />
    </>
  );
}
