import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Archive, ArrowRight, Rocket, Sparkles } from "lucide-react";
import { apiGet, apiPost } from "@/lib/torgima-api";

type UpgradeStatus = {
  requiresUpgrade: boolean;
  executionState: string;
  firstLoginAfterUpgrade: boolean;
  archivedCounts: Record<string, number>;
  migrationApplied: boolean;
};

type ArchivedItem = {
  entityType: string;
  entityId: string;
  archivedAt: string;
  title: string;
  status: string;
};

export default function UpgradePage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<UpgradeStatus | null>(null);
  const [archived, setArchived] = useState<ArchivedItem[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const s = await apiGet<UpgradeStatus>("/api/upgrade/status");
        setStatus(s);
        if (!s.requiresUpgrade) {
          setLocation("/validate");
          return;
        }
        await apiPost("/api/upgrade/acknowledge");
        const a = await apiGet<{ items: ArchivedItem[] }>("/api/upgrade/archived");
        setArchived(a.items ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [setLocation]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent" />
      </div>
    );
  }

  const totalArchived = Object.values(status?.archivedCounts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-[#5B21FF]" />
          <p className="text-sm font-bold uppercase tracking-wide text-[#5B21FF]">Platform Upgrade</p>
        </div>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">Torgima has been upgraded</h1>
        <p className="mt-4 text-base leading-relaxed text-[#64748B]">
          Your previous execution data has been archived.
          <br />
          To benefit from the new validation, blueprint, and execution systems, please create a new direction.
        </p>

        <div className="mt-8 rounded-2xl border border-[#ECECF4] bg-[#FAFAFA] p-6">
          <p className="text-sm font-semibold text-[#0B1220]">What happens next</p>
          <ol className="mt-3 space-y-2 text-sm text-[#64748B] list-decimal list-inside">
            <li>Refine your goal and purpose</li>
            <li>Set context and timeframe</li>
            <li>Run Erector validation</li>
            <li>Review results and launch your blueprint</li>
            <li>Resume execution on the new dashboard</li>
          </ol>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/validate">
            <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200/50">
              <Rocket className="h-4 w-4" />
              Start New Validation
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-6 py-3 text-sm font-semibold text-[#0B1220] hover:bg-[#F8FAFC]"
          >
            <Archive className="h-4 w-4" />
            View Archived Data {totalArchived > 0 ? `(${totalArchived})` : ""}
          </button>
        </div>

        {showArchive && (
          <div className="mt-8 rounded-2xl border border-[#ECECF4] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Archived records</p>
            {archived.length === 0 ? (
              <p className="mt-3 text-sm text-[#64748B]">No archived records found for your account.</p>
            ) : (
              <ul className="mt-3 max-h-64 overflow-y-auto divide-y divide-[#F1F5F9]">
                {archived.map((item) => (
                  <li key={`${item.entityType}-${item.entityId}`} className="py-2 text-sm">
                    <span className="font-semibold text-[#0B1220]">{item.title}</span>
                    <span className="ml-2 text-xs text-[#94A3B8]">
                      {item.entityType} · {item.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
