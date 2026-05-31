import { SectionHeading } from "@/components/shared/SectionHeading";

const youDo = [
  "Validate your idea (2 minutes)",
  "Name your project",
  "Get your execution plan",
  "Execute 8 daily tasks",
  "Submit what happened",
  "System adapts and continues",
];

const torgimaDoes = [
  "Analyzes market reality, competitors, opportunities",
  "Builds your complete project structure",
  "Generates 8 specific tasks matched to your goal",
  "Tracks your performance through signals",
  "Adapts your next tasks based on reality",
  "Never stops until your goal is done",
];

export function SolutionSection() {
  return (
    <section className="section-dark py-20 sm:py-28">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <SectionHeading title="Torgima is your execution system. Not a task list." />
        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div className="glass-card rounded-2xl p-8">
            <h3 className="font-syne font-bold text-xl text-primary-bright mb-6">What you do</h3>
            <ol className="space-y-4">
              {youDo.map((item, i) => (
                <li key={item} className="flex gap-4 text-zinc-300">
                  <span className="font-jet text-primary-bright shrink-0">{i + 1}.</span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
          <div className="glass-card rounded-2xl p-8 border-primary/30">
            <h3 className="font-syne font-bold text-xl text-white mb-6">What Torgima does</h3>
            <ol className="space-y-4">
              {torgimaDoes.map((item, i) => (
                <li key={item} className="flex gap-4 text-zinc-300">
                  <span className="font-jet text-primary-bright shrink-0">{i + 1}.</span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
