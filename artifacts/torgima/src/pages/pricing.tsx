import { Link } from "wouter";
import { Check, Minus } from "lucide-react";
import { MarketingLayout, MarketingSection } from "@/components/marketing/MarketingLayout";
import { useMarketingMetadata } from "@/lib/marketing-metadata";

const freeFeatures = [
  "Full execution loop: goals, blueprints, tasks, feedback, signals",
  "All 7 conditions and control rules",
  "Basic cached intelligence",
  "Academy and capability gap detection",
  "Dashboard with condition, signals, blueprint health",
  "Standard task knowledge injection",
];

const intelligenceFeatures = [
  "Full overnight intelligence, all 9 EIS modules",
  "Daily Morning Intelligence Report",
  "Strategic Outlook Panel",
  "Competitor tracking",
  "Trend velocity scoring",
  "Narrative intelligence",
  "Opportunity window detection",
  "Full signal history",
  "Priority support",
];

export default function PricingPage() {
  useMarketingMetadata({
    title: "Pricing",
    description: "Free to execute. Upgrade for overnight intelligence, strategic outlook, competitor tracking, and full signal history.",
    path: "/pricing",
  });

  const rows = [
    "Execution loop",
    "7 conditions",
    "Academy",
    "Morning Intelligence Report",
    "Strategic Outlook Panel",
    "Competitor intelligence",
    "Trend velocity analysis",
    "Narrative intelligence",
    "Extended signal history",
  ];

  return (
    <MarketingLayout>
      <section className="px-5 py-24 text-center lg:px-8">
        <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-[-0.03em]">Free to execute. Upgrade for overnight intelligence.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
          Start with the complete execution loop. Add the full intelligence layer when you want Torgima working harder while you sleep.
        </p>
      </section>

      <MarketingSection title="Choose your operating mode" eyebrow="Pricing">
        <div className="grid gap-6 lg:grid-cols-2">
          <Tier name="Execution" price="Free, forever" features={freeFeatures} cta="Start executing free" href="/signup" />
          <Tier name="Intelligence" price="TBD" features={intelligenceFeatures} cta="Get full intelligence" href="/signup" highlighted />
        </div>
      </MarketingSection>

      <MarketingSection title="Feature comparison" eyebrow="No fine print">
        <div className="overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white">
          {rows.map((row) => {
            const paidOnly = row.includes("Morning") || row.includes("Strategic") || row.includes("Competitor") || row.includes("Trend") || row.includes("Narrative") || row.includes("Extended");
            return (
              <div key={row} className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-[#E5E7EB] p-4 text-sm last:border-b-0">
                <span className="font-medium">{row}</span>
                <span className="flex justify-center">{paidOnly ? <Minus className="h-4 w-4 text-gray-300" /> : <Check className="h-4 w-4 text-green-600" />}</span>
                <span className="flex justify-center"><Check className="h-4 w-4 text-green-600" /></span>
              </div>
            );
          })}
        </div>
      </MarketingSection>

      <MarketingSection title="FAQ" eyebrow="Questions">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Is free really free?", "Yes. The core execution loop is free to start and use."],
            ["Can I upgrade anytime?", "Yes. The Intelligence tier unlocks overnight research and deeper history when available."],
            ["What is Bhudhi?", "Bhudhi is the controlled intelligence layer that interprets execution data and drafts context."],
          ].map(([q, a]) => (
            <div key={q} className="rounded-3xl border border-[#E5E7EB] bg-white p-6">
              <p className="font-bold">{q}</p>
              <p className="mt-3 text-sm leading-6 text-gray-600">{a}</p>
            </div>
          ))}
        </div>
      </MarketingSection>
    </MarketingLayout>
  );
}

function Tier({
  name,
  price,
  features,
  cta,
  href,
  highlighted,
}: {
  name: string;
  price: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`rounded-3xl border p-8 ${highlighted ? "border-[#0EA5E9] bg-white shadow-sm" : "border-[#E5E7EB] bg-white"}`}>
      <p className="text-2xl font-bold">{name}</p>
      <p className="mt-4 text-4xl font-black">{price}</p>
      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3 text-sm leading-6 text-gray-700">
            <Check className="mt-1 h-4 w-4 shrink-0 text-green-600" />
            {feature}
          </li>
        ))}
      </ul>
      <Link href={href} className={`mt-8 inline-flex rounded-full px-6 py-3 text-sm font-bold ${highlighted ? "bg-[#0EA5E9] text-white" : "bg-[#0A0F1E] text-white"}`}>
        {cta}
      </Link>
    </div>
  );
}
