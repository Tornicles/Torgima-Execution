import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ErectorDashboardView } from "@/components/erector/ErectorDashboardView";
import { getAuthSession } from "@/lib/torgima-api";

/** Erector Reality & Preparation home — uses main app Layout via App route wrapper. */
export default function ErectorDashboardPage() {
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void getAuthSession()
      .then((data) => {
        if (!(data as { authenticated?: boolean })?.authenticated) setLocation("/login");
      })
      .catch(() => setLocation("/login"))
      .finally(() => setChecking(false));
  }, [setLocation]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-sm text-[#64748B]">
        Loading…
      </div>
    );
  }

  return <ErectorDashboardView />;
}
