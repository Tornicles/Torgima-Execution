import { SectionHeading } from "@/components/shared/SectionHeading";
import { TESTIMONIALS } from "@/lib/marketing-content";

export function TestimonialsSection() {
  return (
    <section className="section-light py-20 sm:py-28">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <SectionHeading light title="What people say when the system works." />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.name}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col"
            >
              <p className="text-zinc-700 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-6 pt-4 border-t border-zinc-100">
                <p className="font-semibold text-[#18181b]">{t.name}</p>
                <p className="text-sm text-zinc-500">
                  {t.role}, {t.country}
                </p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
