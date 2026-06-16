import { LimitedDashboard } from "./LimitedDashboard/LimitedDashboard";
import type { LimitedDashboardPayload } from "./LimitedDashboard/limited-dashboard-types";

export type LimitedModeDashboardProps = LimitedDashboardPayload;

/** Gap Fix 3 — LIMITED dashboard entry (server-driven variant). */
export function LimitedModeDashboard(props: LimitedModeDashboardProps) {
  return <LimitedDashboard payload={props} />;
}
