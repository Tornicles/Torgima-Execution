import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { fetchCompletionSummary } from "@/lib/dashboard-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface CompletionScreenProps {
  blueprintId: string;
}

function formatMaybeDate(v: string | Date | null | undefined): string {
  if (v == null) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function CompletionScreen({ blueprintId }: CompletionScreenProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["completion-summary", blueprintId],
    queryFn: () => fetchCompletionSummary(blueprintId),
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-[min(560px,100%)]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background p-8 font-mono text-sm">
        <p className="text-muted-foreground">Completion summary unavailable.</p>
        <Button variant="outline" onClick={() => refetch()} className="uppercase text-xs font-mono">
          Retry load
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-background">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-10 p-10 pt-14">
        <header className="space-y-2 border-b border-border pb-6">
          <p className="text-xs font-mono uppercase tracking-widest text-primary">BLUEPRINT_CLOSED</p>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Execution completed</h1>
          <p className="text-sm text-muted-foreground">
            Completed {formatMaybeDate(data.completedAt)}
            {data.daysToCompletion > 0 ? ` · ${data.daysToCompletion} day runway` : ""}.
          </p>
        </header>

        <section className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xs font-mono uppercase text-muted-foreground">Goal</h2>
          <p className="text-lg font-medium leading-relaxed">{data.goal ?? "—"}</p>
        </section>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Tasks" value={String(data.tasksCompleted)} />
          <Stat label="Avg score" value={data.averageScore.toFixed(1)} />
          <Stat label="Capability" value={data.finalCapabilityLevel} />
          <Stat label="Identity" value={data.finalIdentityStage} />
          <Stat label="Capability carry-forward" value={data.capabilityCarriesForward ? "Yes" : "No"} />
          <Stat label="Identity carry-forward" value={data.identityCarriesForward ? "Yes" : "No"} />
        </div>

        {data.milestones.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-mono uppercase text-muted-foreground">Milestones</h2>
            <ul className="space-y-2 font-mono text-sm">
              {data.milestones.map((m, i) => (
                <li
                  key={`${m.title ?? "m"}-${i}`}
                  className="flex justify-between gap-4 border border-border/60 bg-secondary/30 px-3 py-2"
                >
                  <span className="truncate">{m.title ?? m.type}</span>
                  <span className="text-muted-foreground">{formatMaybeDate(m.date)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
          <Link href="/onboarding">
            <Button className="w-full font-mono uppercase text-xs sm:w-auto">Start new blueprint</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="w-full font-mono uppercase text-xs sm:w-auto">
              Return home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-[10px] font-mono uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold">{value}</p>
    </div>
  );
}
