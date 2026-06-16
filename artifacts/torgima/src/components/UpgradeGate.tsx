import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiGet } from "@/lib/torgima-api";
import { isPreLaunchPath } from "@/hooks/useAppRouteGuard";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/verify",
  "/auth/callback",
  "/how-it-works",
  "/pricing",
  "/about",
  "/changelog",
  "/validate",
  "/project-intelligence",
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

type UpgradeStatusResponse = {
  requiresUpgrade?: boolean;
  upgradeRequired?: boolean;
  launchMode?: boolean;
  tier?: string;
  mode?: string;
};

/**
 * Module-level cache — avoids repeating the upgrade status API call on every
 * page navigation.  In launch mode (launchMode:true) the response is stable for
 * the entire session so we can cache indefinitely.  Otherwise we re-check once
 * per minute to detect state transitions.
 */
let cachedStatus: UpgradeStatusResponse | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 1 minute for non-launch-mode

function getCached(): UpgradeStatusResponse | null {
  if (!cachedStatus) return null;
  if (cachedStatus.launchMode) return cachedStatus; // stable in launch mode
  if (Date.now() < cacheExpiry) return cachedStatus;
  return null;
}

function setCache(status: UpgradeStatusResponse): void {
  cachedStatus = status;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
}

/**
 * Redirects users with execution_state=RESET_REQUIRED to /upgrade
 * unless they are on a pre-launch or upgrade-allowed path.
 *
 * In LAUNCH_MODE (launchMode:true) upgradeRequired is always false,
 * so no redirect ever fires.  The result is cached to avoid a spinner
 * on every page navigation.
 */
export function UpgradeGate({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [checking, setChecking] = useState(() => {
    // If we have a valid cached result, start in ready state — no spinner.
    const cached = getCached();
    if (!cached) return true;
    if (cached.requiresUpgrade && !isPublicPath(location) && !isUpgradeAllowedPath(location)) {
      return true; // will redirect, show spinner briefly
    }
    return false;
  });

  useEffect(() => {
    if (isPublicPath(location)) {
      setChecking(false);
      return;
    }

    // Use cached result if still valid.
    const cached = getCached();
    if (cached) {
      if ((cached.requiresUpgrade || cached.upgradeRequired) && !isUpgradeAllowedPath(location)) {
        setLocation("/upgrade");
      }
      setChecking(false);
      return;
    }

    // Fetch from API.
    setChecking(true);
    void apiGet<UpgradeStatusResponse>("/api/upgrade/status")
      .then((status) => {
        setCache(status);
        const needsUpgrade = status.requiresUpgrade || status.upgradeRequired;
        if (needsUpgrade && !isUpgradeAllowedPath(location)) {
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
