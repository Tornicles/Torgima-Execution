import { Button } from "@/components/shared/Button";
import { VALIDATE_URL } from "@/lib/seo";

const trust = [
  "Idea validated by real market intelligence",
  "Complete project structure built automatically",
  "8 daily tasks generated from your goal",
  "Adapts to how you actually perform",
];

export function FinalCTA() {
  return (
    <section className="relative py-24 sm:py-32 mesh-bg overflow-hidden">
      <div className="mx-auto max-w-content px-4 sm:px-6 text-center relative z-10">
        <h2 className="font-syne text-3xl sm:text-5xl font-bold text-white tracking-tight">
          You already know what you want to build.
        </h2>
        <p className="mt-4 text-lg text-zinc-400 max-w-xl mx-auto">
          You just need the system that makes you execute it.
        </p>
        <div className="mt-10">
          <Button href={VALIDATE_URL} variant="primary" className="text-lg px-10 py-4">
            Validate My Idea — It&apos;s Free →
          </Button>
          <p className="mt-3 text-sm text-zinc-500">No credit card. No setup. Results in 2 minutes.</p>
        </div>
        <ul className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-zinc-400">
          {trust.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
