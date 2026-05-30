import { apiGet, apiPost } from "@/lib/torgima-api";
import type { BhudhiExplainResponse, BhudhiHubPanels } from "@/lib/bhudhi-hub-types";

export async function fetchBhudhiHub(blueprintId: string): Promise<BhudhiHubPanels | null> {
  const data = await apiGet<{ hub: BhudhiHubPanels }>(
    `/api/bhudhi/hub?blueprintId=${encodeURIComponent(blueprintId)}`,
  );
  return data.hub ?? null;
}

export async function explainBhudhiQuestion(params: {
  blueprintId: string;
  questionKey: string;
  glanceKey?: "condition" | "momentum" | "focus" | "goal_progress";
}): Promise<BhudhiExplainResponse> {
  return apiPost<BhudhiExplainResponse>("/api/bhudhi/hub/explain", params);
}
