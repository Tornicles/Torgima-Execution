import { apiFetch } from "@/config/api";

export type ValidationRunStatus = {
  id: string;
  status: string;
  verdict?: string | null;
  reality_score?: number | null;
  blueprint_launched?: boolean;
  selected_path?: string | null;
};

const STATUS_TO_STEP: Record<string, number> = {
  pending: 0,
  running_analysis: 1,
  running_reality_check: 2,
  running_path_analysis: 3,
  complete: 4,
  failed: -1,
};

export function validationStatusStep(status: string): number {
  return STATUS_TO_STEP[status] ?? 1;
}

/** Poll structured validation run until complete or failed (3s interval). */
export async function pollValidationRunStatus(
  runId: string,
  onTick: (status: ValidationRunStatus) => void,
  options?: { intervalMs?: number; maxMs?: number },
): Promise<ValidationRunStatus> {
  const intervalMs = options?.intervalMs ?? 3000;
  const maxMs = options?.maxMs ?? 120_000;
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
