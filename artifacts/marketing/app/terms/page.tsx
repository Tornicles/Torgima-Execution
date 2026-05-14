import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing your use of Torgima.",
};

export default function TermsPage() {
  return (
    <div className="py-section-sm lg:py-section px-4 max-w-content mx-auto">
      <h1 className="font-syne font-extrabold text-4xl text-[var(--color-text-primary)] mb-2">Terms of Service</h1>
      <p className="font-dm text-sm text-[var(--color-text-muted)] mb-12">Last updated: May 14, 2026</p>
      {[1, 2, 3, 4].map((n) => (
        <section key={n} className="mb-10">
          <h2 className="font-syne font-bold text-xl text-[var(--color-text-primary)] mb-3">Section {n}</h2>
          <p className="font-dm text-[var(--color-text-secondary)] leading-relaxed">
            Placeholder terms copy. Replace with counsel-approved text covering accounts, acceptable use, disclaimers, and
            limitation of liability.
          </p>
        </section>
      ))}
    </div>
  );
}
