import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { STATS } from "@/lib/constants";

export function StatsBar() {
  return (
    <section className="border-y border-dark-border bg-dark-card py-16">
      <div className="mx-auto max-w-content px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
        <div>
          <p className="font-syne text-3xl sm:text-4xl font-bold text-white">
            <AnimatedCounter end={STATS.users} suffix="+" />
          </p>
          <p className="mt-1 text-sm text-zinc-500">Active builders</p>
        </div>
        <div>
          <p className="font-syne text-3xl sm:text-4xl font-bold text-white">
            <AnimatedCounter end={STATS.tasksCompleted} suffix="+" />
          </p>
          <p className="mt-1 text-sm text-zinc-500">Tasks completed</p>
        </div>
        <div>
          <p className="font-syne text-3xl sm:text-4xl font-bold text-white">
            <AnimatedCounter end={STATS.validations} suffix="+" />
          </p>
          <p className="mt-1 text-sm text-zinc-500">Ideas validated</p>
        </div>
        <div>
          <p className="font-syne text-3xl sm:text-4xl font-bold text-white">4.9</p>
          <p className="mt-1 text-sm text-zinc-500">Avg. rating</p>
        </div>
      </div>
    </section>
  );
}
