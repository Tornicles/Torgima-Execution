import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getGetDashboardStateQueryOptions } from "@workspace/api-client-react";
import { getAuthSession } from "@/lib/torgima-api";
import { getDashboardUiState, toDashboardProjection } from "@/lib/dashboard-types";

const PRE_LAUNCH_PREFIXES = ["/validate", "/validation/", "/onboarding", "/erector"];
const POST_LAUNCH_HOME = "/dashboard";

export function isPreLaunchPath(path: string): boolean {
  if (path === "/validate" || path === "/erector" || path.startsWith("/onboarding")) return true;
  if (path.startsWith("/validation/") && !path.includes("/results") && path.endsWith("/running")) return true;
  if (path.includes("/validation/") && path.endsWith("/results")) return true;
  if (path.includes("/validation/") && path.endsWith("/blueprint")) return true;
  if (path === "/validation" || path === "/validation/scores") return true;
  return false;
}

export function useAppRouteGuard(mode: "pre-launch" | "post-launch") {
  const [location, setLocation] = useLocation();
  const [authOk, setAuthOk] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const dashQuery = useQuery({
    ...getGetDashboardStateQueryOptions(),
    enabled: authOk,
  });

  const projection = dashQuery.data ? toDashboardProjection(dashQuery.data) : null;
  const hasActiveBlueprint = Boolean(projection?.activeBlueprint);
  const uiState = getDashboardUiState(projection);

  useEffect(() => {
    void getAuthSession()
      .then((data) => {
        if ((data as { authenticated?: boolean })?.authenticated) setAuthOk(true);
        else setLocation("/login");
      })
      .catch(() => setLocation("/login"))
      .finally(() => setCheckingAuth(false));
  }, [setLocation]);

  useEffect(() => {
    if (!authOk || dashQuery.isLoading) return;

    if (mode === "post-launch") {
      if (!hasActiveBlueprint && uiState === "NO_BLUEPRINT") {
        setLocation("/validate");
      }
      return;
    }

    if (mode === "pre-launch" && hasActiveBlueprint) {
      const onValidationResults =
        location.startsWith("/validation/") && location.endsWith("/results");
      const onErectorFlow =
        location.startsWith("/onboarding") ||
        location.startsWith("/erector") ||
        location.startsWith("/validation/");
      if (!onValidationResults && !onErectorFlow && location === "/validate") {
        setLocation(POST_LAUNCH_HOME);
      }
    }
  }, [authOk, mode, hasActiveBlueprint, uiState, dashQuery.isLoading, location, setLocation]);

  return {
    checking: checkingAuth || (authOk && dashQuery.isLoading),
    hasActiveBlueprint,
    projection,
  };
}

export { POST_LAUNCH_HOME };
