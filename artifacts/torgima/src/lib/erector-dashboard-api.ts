import { apiGet } from "@/lib/torgima-api";
import type { ErectorDashboardPanels } from "@/lib/erector-dashboard-types";

export async function fetchErectorDashboard(): Promise<ErectorDashboardPanels> {
  const data = await apiGet<{ panels?: ErectorDashboardPanels }>("/api/erector/dashboard");
  if (!data?.panels) {
    throw new Error("Erector dashboard response missing panels");
  }
  return data.panels;
}
