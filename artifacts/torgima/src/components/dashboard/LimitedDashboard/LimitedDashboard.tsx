import type { LimitedDashboardPayload } from "./limited-dashboard-types";
import { fallbackLimitedContext, isLimitedDashboardPayload } from "./limited-dashboard-types";
import { VariantA_PostFreeValidation } from "./VariantA_PostFreeValidation";
import { VariantB_DirectSignup } from "./VariantB_DirectSignup";
import { VariantC_IntakeInProgress } from "./VariantC_IntakeInProgress";

export type { LimitedDashboardPayload } from "./limited-dashboard-types";
export { isLimitedDashboardPayload } from "./limited-dashboard-types";

type Props = {
  payload: LimitedDashboardPayload;
};

/** Gap Fix 3 — routes LIMITED dashboard to variant A/B/C from server projection. */
export function LimitedDashboard({ payload }: Props) {
  const context =
    payload.limited_context ??
    fallbackLimitedContext(payload.limited_variant ?? "direct_signup");

  if (payload.limited_variant === "post_free_validation" && context.variant === "post_free_validation") {
    return <VariantA_PostFreeValidation context={context} userEmail={payload.user.email} />;
  }

  if (payload.limited_variant === "intake_in_progress" && context.variant === "intake_in_progress") {
    return <VariantC_IntakeInProgress context={context} userEmail={payload.user.email} />;
  }

  if (context.variant === "direct_signup") {
    return <VariantB_DirectSignup context={context} userEmail={payload.user.email} />;
  }

  const fallback = fallbackLimitedContext("direct_signup");
  if (fallback.variant !== "direct_signup") {
    return null;
  }
  return <VariantB_DirectSignup context={fallback} userEmail={payload.user.email} />;
}
