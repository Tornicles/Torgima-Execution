import Link from "next/link";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { USE_CASES_PREVIEW } from "@/lib/marketing-content";

export function UseCasesPreview() {
  return (
    <section className="section-dark py-20 sm:py-28">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <SectionHeading title="Built for people who actually need to execute." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES_PREVIEW.map((uc) => (
            <Link
              key={uc.href}
              href={uc.href}
              className="glass-card rounded-2xl p-6 hover:border-primary-bright/50 transition-colors group"
            >
              <span className="text-2xl">{uc.emoji}</span>
              <h3 className="mt-4 font-syne font-bold text-white group-hover:text-primary-bright">
                {uc.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">{uc.desc}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-primary-bright">
                See how →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
