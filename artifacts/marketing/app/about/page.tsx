import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Mission, philosophy, and what Torgima is — and is not.",
};

export default function AboutPage() {
  return (
    <div className="py-section-sm lg:py-section px-4 max-w-content mx-auto space-y-14">
      <header>
        <h1 className="font-syne font-extrabold text-4xl sm:text-5xl text-[var(--color-text-primary)]">Built for people who execute.</h1>
      </header>

      <section>
        <h2 className="font-syne font-bold text-2xl mb-4 text-[var(--color-text-primary)]">Mission</h2>
        <p className="font-dm text-[var(--color-text-secondary)] leading-relaxed">
          Torgima exists because most people don&apos;t fail from lack of ideas. They fail from lack of execution structure. We built
          the system we always needed.
        </p>
      </section>

      <section>
        <h2 className="font-syne font-bold text-2xl mb-4 text-[var(--color-text-primary)]">What Torgima is</h2>
        <div className="space-y-4 font-dm text-[var(--color-text-secondary)] leading-relaxed">
          <p>
            <strong className="text-[var(--color-text-primary)]">Goal → System.</strong>{" "}
            Not a loose list. A validated map from intent to daily tasks.
          </p>
          <p>
            <strong className="text-[var(--color-text-primary)]">Signals → Truth.</strong>{" "}
            Not vanity streaks. Readouts that steer difficulty, load, and recovery.
          </p>
          <p>
            <strong className="text-[var(--color-text-primary)]">Adaptation → Intelligence.</strong>{" "}
            Not nagging. The plan changes when reality does.
          </p>
        </div>
      </section>

      <section>
        <h2 className="font-syne font-bold text-2xl mb-4 text-[var(--color-text-primary)]">What Torgima is not</h2>
        <ul className="list-disc list-inside space-y-2 font-dm text-[var(--color-text-secondary)]">
          <li>Not a task manager</li>
          <li>Not a habit tracker</li>
          <li>Not a project management tool</li>
          <li>Not a chatbot</li>
          <li>Not another AI assistant</li>
        </ul>
      </section>

      <blockquote className="border-l-2 border-[var(--color-accent-purple)] pl-6 py-2 font-dm text-lg italic text-[var(--color-text-primary)]">
        Humans execute. Torgima guides. Blueprints structure. Signals reveal truth.
      </blockquote>
    </div>
  );
}
