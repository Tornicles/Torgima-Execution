import { PageHero } from "@/components/pages/PageHero";
import { FinalCTA } from "@/components/home/FinalCTA";
import { Button } from "@/components/shared/Button";
import { VALIDATE_URL } from "@/lib/seo";
import type { UseCaseContent } from "@/lib/use-case-content";

export function UseCasePage({ data }: { data: UseCaseContent }) {
  return (
    <>
      <PageHero eyebrow={data.title} title={data.headline} subtitle={data.subtitle} />
      <section className="section-light py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <h2 className="font-syne text-2xl font-bold text-[#18181b]">The problem</h2>
          <ul className="mt-6 space-y-3">
            {data.problems.map((p) => (
              <li key={p} className="text-zinc-600 flex gap-2">
                <span className="text-red-500">✗</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="section-dark py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <h2 className="font-syne text-2xl font-bold text-white">How Torgima helps</h2>
          <ul className="mt-6 space-y-3">
            {data.solutions.map((s) => (
              <li key={s} className="text-zinc-300 flex gap-2">
                <span className="text-emerald-400">✓</span>
                {s}
              </li>
            ))}
          </ul>
          <h3 className="mt-12 font-syne text-xl font-bold text-primary-bright">Built for you</h3>
          <ul className="mt-4 grid sm:grid-cols-2 gap-3">
            {data.features.map((f) => (
              <li key={f} className="glass-card rounded-xl p-4 text-sm text-zinc-300">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="section-light py-16">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <h2 className="font-syne text-2xl font-bold">Typical journey</h2>
          <div className="mt-8 space-y-4">
            {data.journey.map((j) => (
              <div key={j.week} className="flex gap-4 border-l-2 border-primary pl-6">
                <div>
                  <p className="font-bold text-primary">{j.week}</p>
                  <p className="text-zinc-600">{j.text}</p>
                </div>
              </div>
            ))}
          </div>
          {data.testimonial ? (
            <blockquote className="mt-12 rounded-2xl bg-primary/5 border border-primary/20 p-8">
              <p className="text-lg text-zinc-700 italic">&ldquo;{data.testimonial.quote}&rdquo;</p>
              <footer className="mt-4 font-semibold">
                — {data.testimonial.name}, {data.testimonial.role}
              </footer>
            </blockquote>
          ) : null}
          <div className="mt-10">
            <Button href={VALIDATE_URL}>Validate Your {data.title} Idea →</Button>
          </div>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
