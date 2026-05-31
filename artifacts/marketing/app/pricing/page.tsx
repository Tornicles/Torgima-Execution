import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/pages/PageHero";
import { FinalCTA } from "@/components/home/FinalCTA";
import { Button } from "@/components/shared/Button";
import { PRICING } from "@/lib/constants";
import { pageMetadata, VALIDATE_URL } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Torgima Pricing — Free Idea Validation + Execution Plans",
  description:
    "Start free with idea validation. Upgrade for daily tasks, AI execution, and full project management. Plans from $9/month.",
  path: "/pricing",
});

const PLANS = [
  {
    name: "Starter",
    price: PRICING.starter.monthly,
    annual: PRICING.starter.annual,
    for: "People validating their first idea and getting started",
    features: [
      { ok: true, text: "1 active project" },
      { ok: true, text: "Idea validation (3 per month)" },
      { ok: true, text: "Daily tasks (3 tasks/day)" },
      { ok: true, text: "Basic execution signals" },
      { ok: true, text: "Getting Started → Steady Progress states" },
      { ok: true, text: "Bhudhi task generation (basic)" },
      { ok: true, text: "Mobile-responsive web app" },
      { ok: false, text: "Full signal intelligence" },
      { ok: false, text: "Advanced project structure" },
      { ok: false, text: "Downloadable reports" },
      { ok: false, text: "Multiple projects" },
    ],
  },
  {
    name: "Growth",
    price: PRICING.growth.monthly,
    annual: PRICING.growth.annual,
    popular: true,
    for: "Solopreneurs, creators, and founders actively building",
    features: [
      { ok: true, text: "Everything in Starter" },
      { ok: true, text: "3 active projects" },
      { ok: true, text: "Unlimited idea validations" },
      { ok: true, text: "Up to 7 tasks/day" },
      { ok: true, text: "Full execution signals (all 7 states)" },
      { ok: true, text: "Complete project hierarchy" },
      { ok: true, text: "Downloadable validation reports" },
      { ok: true, text: "Competitor deep intelligence" },
      { ok: true, text: "Bhudhi full intelligence (7 zones)" },
      { ok: true, text: "Weekly review tasks" },
      { ok: true, text: "Recovery system" },
      { ok: true, text: "Priority email support" },
    ],
  },
  {
    name: "Ultimate",
    price: PRICING.ultimate.monthly,
    annual: PRICING.ultimate.annual,
    for: "Serious builders executing at scale",
    features: [
      { ok: true, text: "Everything in Growth" },
      { ok: true, text: "Unlimited projects" },
      { ok: true, text: "Peak Performance state" },
      { ok: true, text: "8 tasks/day maximum" },
      { ok: true, text: "Advanced difficulty (Challenging + Advanced)" },
      { ok: true, text: "Pattern learning & burnout detection" },
      { ok: true, text: "Strategy adaptation engine" },
      { ok: true, text: "White Space Map in validation" },
      { ok: true, text: "Revenue model intelligence" },
      { ok: true, text: "Priority support (24hr response)" },
      { ok: true, text: "Early access to new features" },
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero title="Simple pricing. Serious execution." subtitle="Start free. Upgrade when you're ready to execute daily." />
      <section className="section-dark py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <p className="text-center text-sm text-zinc-500 mb-12">Annual billing saves 30%</p>
          <div className="grid gap-8 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 flex flex-col ${
                  plan.popular ? "border-primary-bright bg-primary/10 scale-[1.02]" : "border-dark-border glass-card"
                }`}
              >
                {plan.popular ? (
                  <span className="text-xs font-bold uppercase text-primary-bright">Most Popular</span>
                ) : null}
                <h3 className="mt-2 font-syne text-2xl font-bold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{plan.for}</p>
                <p className="mt-6">
                  <span className="font-jet text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-zinc-500">/mo</span>
                </p>
                <p className="text-xs text-zinc-600 mt-1">or ${plan.annual}/mo billed annually</p>
                <ul className="mt-8 space-y-2 flex-1 text-sm">
                  {plan.features.map((f) => (
                    <li key={f.text} className={f.ok ? "text-zinc-300" : "text-zinc-600 line-through"}>
                      {f.ok ? "✓" : "✗"} {f.text}
                    </li>
                  ))}
                </ul>
                <Button href={VALIDATE_URL} variant={plan.popular ? "primary" : "ghost"} className="mt-8 w-full">
                  Get Started
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section-light py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6 max-w-2xl">
          <h2 className="font-syne text-2xl font-bold">Pricing FAQ</h2>
          <dl className="mt-8 space-y-6 text-zinc-600">
            <div>
              <dt className="font-semibold text-[#18181b]">Can I change plans later?</dt>
              <dd className="mt-1">Yes — upgrade or downgrade anytime.</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#18181b]">Is there a free trial?</dt>
              <dd className="mt-1">Idea validation is free. Starter includes limited daily execution.</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#18181b]">What counts as one project?</dt>
              <dd className="mt-1">One active goal with its own hierarchy, tasks, and signals.</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#18181b]">Can I cancel anytime?</dt>
              <dd className="mt-1">Yes. No long-term contracts.</dd>
            </div>
          </dl>
          <p className="mt-8">
            <Link href="/faq" className="text-primary font-semibold">
              More questions → FAQ
            </Link>
          </p>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
