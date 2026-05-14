import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-section-sm text-center">
      <span
        className="pointer-events-none font-syne font-extrabold text-[180px] sm:text-[240px] leading-none text-[var(--color-border-hover)] opacity-[0.18] absolute select-none"
        aria-hidden
      >
        404
      </span>
      <div className="relative z-10 max-w-md">
        <h1 className="font-syne font-extrabold text-3xl sm:text-4xl text-[var(--color-text-primary)]">Nothing executing here.</h1>
        <p className="mt-4 font-dm text-[var(--color-text-secondary)]">This page doesn&apos;t exist. Your goal does.</p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-[var(--radius-sm)] bg-[var(--color-accent-purple)] px-6 py-3 font-dm font-medium text-white hover:shadow-[0_0_20px_rgba(124,92,252,0.4)] transition-shadow focus-ring"
        >
          Back to Torgima →
        </Link>
      </div>
    </div>
  );
}
