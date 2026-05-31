import { SectionHeading } from "@/components/shared/SectionHeading";
import { DashboardMockup } from "@/components/shared/DashboardMockup";

const steps = [
  {
    n: 1,
    title: "Validate Your Idea",
    time: "2 min",
    desc: "Enter your goal and purpose. Bhudhi analyzes market data, competitors, opportunities, and delivers your Idea Strength Score.",
    mock: "validator" as const,
  },
  {
    n: 2,
    title: "Review Your Results",
    desc: "See your Reality Score, verdict, competitor profiles, opportunities, and 3 optimized execution paths.",
    mock: "validator" as const,
  },
  {
    n: 3,
    title: "Name and Launch Your Project",
    desc: "Name your project. Select your path. Launch. Torgima builds your architecture and first 8 tasks instantly.",
    mock: "dashboard" as const,
  },
  {
    n: 4,
    title: "Execute Every Day",
    desc: "Complete 8 tasks. Submit feedback. Bhudhi generates your next set based on actual performance.",
    mock: "tasks" as const,
  },
];

export function HowItWorksPreview() {
  return (
    <section className="section-dark py-20 sm:py-28">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <SectionHeading title="From idea to execution in under 5 minutes." />
        <div className="mt-16 space-y-24">
          {steps.map((step, i) => (
            <div
              key={step.n}
              className={`grid gap-10 lg:grid-cols-2 items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
            >
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <p className="font-jet text-primary-bright text-sm">
                  Step {step.n}
                  {step.time ? ` — ${step.time}` : ""}
                </p>
                <h3 className="mt-2 font-syne text-2xl font-bold text-white">{step.title}</h3>
                <p className="mt-4 text-zinc-400 leading-relaxed">{step.desc}</p>
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                <DashboardMockup variant={step.mock} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
