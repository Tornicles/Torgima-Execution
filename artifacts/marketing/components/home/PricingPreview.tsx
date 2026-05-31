import Link from "next/link";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { PRICING } from "@/lib/constants";

const plans = [
  { key: "starter", price: PRICING.starter.monthly, features: ["1 active project", "Idea validation", "3 tasks/day"] },
  { key: "growth", price: PRICING.growth.monthly, popular: true, features: ["3 projects", "Unlimited validations", "Up to 7 tasks/day", "Full signals"] },
  { key: "ultimate", price: PRICING.ultimate.monthly, features: ["Unlimited projects", "8 tasks/day max", "Peak performance state", "Priority support"] },
];

export function PricingPreview() {
  return (
    <section className="section-light py-20 sm:py-28">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <SectionHeading light title="One system. Three levels of intelligence." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.key}
              className={`rounded-2xl border p-8 ${p.popular ? "border-primary bg-primary/5 shadow-lg" : "border-zinc-200 bg-white"}`}
            >
              {p.popular ? (
                <span className="text-xs font-bold uppercase text-primary">Most Popular</span>
              ) : null}
              <h3 className="mt-2 font-syne font-bold text-xl capitalize text-[#18181b]">{p.key}</h3>
              <p className="mt-2">
                <span className="font-jet text-3xl font-bold">${p.price}</span>
                <span className="text-zinc-500">/month</span>
              </p>
              <ul className="mt-6 space-y-2 text-sm text-zinc-600">
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center">
          <Link href="/pricing" className="text-primary font-semibold hover:underline">
            See full pricing comparison →
          </Link>
        </p>
      </div>
    </section>
  );
}
