import { Button } from "@/components/shared/Button";
import { VALIDATE_URL } from "@/lib/seo";

export function PageHero({
  eyebrow,
  title,
  subtitle,
  dark = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <section className={dark ? "mesh-bg py-20 sm:py-28" : "section-light py-20 sm:py-28"}>
      <div className="mx-auto max-w-content px-4 sm:px-6">
        {eyebrow ? (
          <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 ${dark ? "text-primary-bright" : "text-primary"}`}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className={`font-syne text-4xl sm:text-5xl font-bold tracking-tight max-w-3xl ${dark ? "text-white" : "text-[#18181b]"}`}>
          {title}
        </h1>
        {subtitle ? (
          <p className={`mt-6 text-lg leading-relaxed max-w-2xl ${dark ? "text-zinc-400" : "text-zinc-600"}`}>
            {subtitle}
          </p>
        ) : null}
        <div className="mt-8">
          <Button href={VALIDATE_URL} variant="primary">
            Validate My Idea Free →
          </Button>
        </div>
      </div>
    </section>
  );
}
