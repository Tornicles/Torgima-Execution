import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGetDashboardStateQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PivotPathChoice } from "@/lib/dashboard-api";
import { dismissPivotReviewRequest, resolvePivotReviewRequest } from "@/lib/dashboard-api";

interface PivotReviewPayload {
  id?: string;
  triggerType?: string;
  triggerReason?: string;
  conditionAtTrigger?: string | null;
  pathOptions?: unknown;
}

interface Props {
  blueprintId: string;
  reviewId: string;
  pivot: PivotReviewPayload | null | Record<string, unknown> | undefined;
}

const PATH_LABELS: Record<PivotPathChoice, string> = {
  continue: "Stay the course — continue current path",
  adjust: "Adjust execution — tighten without changing destination",
  pivot: "Pivot — reconsider direction / goal framing",
};

export function PivotReviewScreen({ blueprintId, reviewId, pivot }: Props) {
  const qc = useQueryClient();
  const [confirmedPath, setConfirmedPath] = useState<PivotPathChoice | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const meta = pivot as PivotReviewPayload | undefined;

  const resolveMut = useMutation({
    mutationFn: (path: PivotPathChoice) =>
      resolvePivotReviewRequest(blueprintId, reviewId, { selectedPath: path, confirmed: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: getGetDashboardStateQueryKey() }),
  });

  const dismissMut = useMutation({
    mutationFn: () => dismissPivotReviewRequest(blueprintId, reviewId),
    onSuccess: () => qc.invalidateQueries({ queryKey: getGetDashboardStateQueryKey() }),
  });

  return (
    <div className="fixed inset-0 z-[110] overflow-auto bg-background">
      <div className="mx-auto flex min-h-full max-w-xl flex-col gap-8 p-10 pt-12">
        <header className="space-y-2 border-b border-border pb-6">
          <p className="font-mono text-xs uppercase tracking-widest text-violet-400">STRATEGY_REVIEW</p>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Pivot checkpoint</h1>
          <p className="text-sm text-muted-foreground font-mono">Trigger: {meta?.triggerType ?? "—"}</p>
        </header>

        {meta?.triggerReason && (
          <section className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-6">
            <p className="text-sm leading-relaxed">{meta.triggerReason}</p>
          </section>
        )}

        {meta?.pathOptions != null && (
          <section className="space-y-2">
            <p className="text-xs font-mono uppercase text-muted-foreground">Path options (reference)</p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-4 font-mono text-xs">
              {prettyJson(meta.pathOptions)}
            </pre>
          </section>
        )}

        <div className="space-y-4">
          <p className="text-xs font-mono uppercase text-muted-foreground">Choose path</p>
          <div className="flex flex-col gap-3">
            {(Object.keys(PATH_LABELS) as PivotPathChoice[]).map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => setConfirmedPath(path)}
                className={`rounded-md border px-4 py-3 text-left font-mono text-xs transition-colors ${
                  confirmedPath === path
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card hover:bg-secondary/80"
                }`}
              >
                <span className="block text-[10px] uppercase opacity-70">{path}</span>
                {PATH_LABELS[path]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border p-4">
          <Checkbox
            id="pivot-ack"
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(v === true)}
            className="mt-1"
          />
          <label htmlFor="pivot-ack" className="cursor-pointer text-sm leading-relaxed">
            I understand this commits my strategy choice for this review.
          </label>
        </div>

        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            className="font-mono uppercase"
            disabled={!confirmedPath || !acknowledged || resolveMut.isPending}
            onClick={() => confirmedPath && resolveMut.mutate(confirmedPath)}
          >
            {resolveMut.isPending ? "Saving…" : "Confirm selection"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={dismissMut.isPending}
            onClick={() => dismissMut.mutate()}
            className="font-mono text-xs uppercase text-muted-foreground"
          >
            Dismiss review
          </Button>
        </div>
      </div>
    </div>
  );
}

function prettyJson(raw: unknown): string {
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}
