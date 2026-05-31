import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiGet } from "@/lib/torgima-api";
import { isPreLaunchPath } from "@/hooks/useAppRouteGuard";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/verify",
  "/how-it-works",
  "/pricing",
  "/about",
  "/changelog",
  "/notifications/unsubscribe",
  "/profiles/",
  "/principles/",
  "/widget/",
];

function isPublicPath(path: string): boolean {
  if (path === "/") return true;
  return PUBLIC_PREFIXES.some((p) => p !== "/" && path.startsWith(p));
}

function isUpgradeAllowedPath(path: string): boolean {
  return (
    path === "/upgrade" ||
    path === "/validate" ||
    path === "/onboarding" ||
    path.startsWith("/onboarding/") ||
    path.startsWith("/validation/") ||
    isPreLaunchPath(path)
  );
}

/**
 * Redirects users with execution_state=RESET_REQUIRED to /upgrade
 * unless they are on the new Erector onboarding path.
 */
export function UpgradeGate({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isPublicPath(location)) {
      setChecking(false);
      return;
    }

    void apiGet<{ requiresUpgrade?: boolean }>("/api/upgrade/status")
      .then((status) => {
        if (status.requiresUpgrade && !isUpgradeAllowedPath(location)) {
          setLocation("/upgrade");
        }
      })
      .catch(() => null)
      .finally(() => setChecking(false));
  }, [location, setLocation]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
