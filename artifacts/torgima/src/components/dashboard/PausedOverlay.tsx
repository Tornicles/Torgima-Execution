import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Blueprint,
  type CustomFetchOptions,
  getGetDashboardStateQueryKey,
  resumeBlueprint,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { fetchPauseStatus } from "@/lib/dashboard-api";
import { withDashboardStaleRetry } from "@/lib/stale-state-retry";

interface Props {
  blueprintId: string;
  blueprint: Blueprint | null | undefined;
}

export function PausedOverlay({ blueprintId, blueprint }: Props) {
  const queryClient = useQueryClient();

  const { data: pauseStatus } = useQuery({
    queryKey: ["pause-status", blueprintId],
    queryFn: () => fetchPauseStatus(blueprintId),
    refetchInterval: 15_000,
  });

  const resumeMut = useMutation({
    mutationFn: async () => {
      return withDashboardStaleRetry(queryClient, async (sv) =>
        resumeBlueprint(blueprintId, {
          method: "POST",
          expectedStateVersion: sv,
        } as CustomFetchOptions),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetDashboardStateQueryKey() });
    },
  });

  const reason = blueprint?.pausedReason ?? pauseStatus?.pauseReason ?? "Paused";
  const mode = pauseStatus?.resumeMode;

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-8 p-10">
        <header className="space-y-2 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500">PAUSED_STATE</p>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Execution paused</h1>
          {mode && (
            <p className="font-mono text-xs text-muted-foreground">
              Resume mode: <span className="text-foreground">{mode}</span>
            </p>
          )}
        </header>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6">
          <p className="text-sm font-medium leading-relaxed">{reason}</p>
          {pauseStatus?.pausedAt != null && (
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Since {new Date(pauseStatus.pausedAt).toLocaleString()}
              {pauseStatus.pauseGapDays > 0 ? ` · gap ${pauseStatus.pauseGapDays}d` : ""}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="font-mono uppercase"
            disabled={resumeMut.isPending}
            onClick={() => resumeMut.mutate()}
          >
            {resumeMut.isPending ? "Resuming…" : "Resume blueprint"}
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/blueprint/${blueprintId}`}>
              <span className="font-mono text-xs uppercase">Open blueprint controls</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
