import { apiFetch } from "@/config/api";

export type ValidationRunStatus = {
  id: string;
  status: string;
  verdict?: string | null;
  reality_score?: number | null;
  blueprint_launched?: boolean;
  selected_path?: string | null;
};

/** Nine-phase pipeline labels (Part 5.4). */
export const VALIDATION_PIPELINE_STAGES = [
  "Input",
  "Analysing your idea…",
  "Checking market reality…",
  "Researching The Pioneer competitor…",
  "Researching The Fast-Mover…",
  "Researching The Indie-Survivor…",
  "Building your execution paths…",
  "Writing your analysis…",
  "Results ready",
] as const;

const STATUS_TO_STEP: Record<string, number> = {
  pending: 0,
  running_analysis: 1,
  running_reality_check: 2,
  researching_competitor_pioneer: 3,
  researching_competitor_fast_mover: 4,
  researching_competitor_indie_survivor: 5,
  running_path_analysis: 6,
  generating_explanations: 7,
  complete: 8,
  failed: -1,
};

export function validationStatusStep(status: string): number {
  return STATUS_TO_STEP[status] ?? 1;
}

export function validationPipelineLabel(status: string): string {
  const step = validationStatusStep(status);
  if (step < 0) return "Validation failed";
  return VALIDATION_PIPELINE_STAGES[step] ?? VALIDATION_PIPELINE_STAGES[1];
}

/** Poll structured validation run until complete or failed (3s interval). */
export async function pollValidationRunStatus(
  runId: string,
  onTick: (status: ValidationRunStatus) => void,
  options?: { intervalMs?: number; maxMs?: number },
): Promise<ValidationRunStatus> {
  const intervalMs = options?.intervalMs ?? 3000;
  const maxMs = options?.maxMs ?? 180_000;
  const start = Date.now();

  for (;;) {
    const res = await apiFetch(`/api/erector/validation/${runId}/status`);
    const json = (await res.json()) as { data?: ValidationRunStatus };
    const status = json.data;
    if (!status) throw new Error("Invalid status response");
    onTick(status);
    if (status.status === "complete" || status.status === "failed") return status;
    if (Date.now() - start > maxMs) throw new Error("Validation timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
