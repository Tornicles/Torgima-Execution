import { useState } from "react";
import { Link } from "wouter";
import { Mic, RefreshCw } from "lucide-react";
import { useBhudhiDashboard } from "@/hooks/useBhudhiDashboard";
import {
  executeBhudhiRecommendation,
  generateBhudhiRecommendations,
  runBhudhiCompleteCycle,
  runBhudhiInvestigate,
} from "@/lib/bhudhi-api";
import { formatConfidence, getSignalColor, getSignalLabel } from "@/lib/bhudhi-signals";
import { buttons } from "@/design";

const SECTIONS = [
  "overview",
  "systems",
  "frameworks",
  "recommendations",
  "insights",
  "external",
] as const;

type Section = (typeof SECTIONS)[number];

const BHUDHI_20_MODULES = [
  { name: "CIS", system: "Investigation" },
  { name: "EIS", system: "Investigation" },
  { name: "BIS", system: "Investigation" },
  { name: "IIS", system: "Intelligence" },
  { name: "SIS", system: "Intelligence" },
  { name: "PIS", system: "Intelligence" },
  { name: "KIS", system: "Intelligence" },
  { name: "RIEZ", system: "Operating" },
] as const;

const TEAM_FRAMEWORK_SAMPLES = [
  "STRATEGYCORE",
  "OMNIGROWTH",
  "CUSTOMERVALUE",
  "SYNERGYOPS",
];

export function BhudhiDashboard({ blueprintId }: { blueprintId: string }) {
  const {
    status,
    signals,
    insights,
    recommendations,
    connections,
    loading,
    error,
    lastUpdated,
    reload,
    refreshSignals,
  } = useBhudhiDashboard(blueprintId);

  const [selectedSection, setSelectedSection] = useState<Section>("overview");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [lastCycleStrategy, setLastCycleStrategy] = useState<string | null>(null);

  const globalSignal = signals?.signal ?? status?.signals?.global ?? null;
  const globalConfidence = signals?.confidence ?? status?.signals?.confidence ?? null;

  async function runAction(key: string, fn: () => Promise<unknown>) {
    setActionBusy(key);
    try {
      await fn();
      await reload();
    } finally {
      setActionBusy(null);
    }
  }

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-8">
        <p className="text-2xl font-light text-gray-600">Bhudhi is analyzing…</p>
      </div>
    );
  }

  if (!blueprintId) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No active blueprint. Open Bhudhi from your dashboard after launch.</p>
        <Link href="/dashboard" className="text-[var(--torgima-primary)] underline mt-4 inline-block">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-full p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-gray-900">BHUDHI</h1>
            <p className="text-sm text-gray-500 mt-1 font-mono truncate max-w-md">
              Intelligence layer · {blueprintId.slice(0, 8)}…
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttons.secondary}
              disabled={!!actionBusy}
              onClick={() => void reload()}
            >
              <RefreshCw className="w-4 h-4 inline mr-1" />
              Refresh
            </button>
            <Link
              href={`/console/governance?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Governance
            </Link>
            <Link
              href={`/bhudhi/economics?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Economics
            </Link>
            <Link
              href={`/bhudhi/decision?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Decisions
            </Link>
            <Link
              href={`/bhudhi/beliefs?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Beliefs
            </Link>
            <Link
              href={`/bhudhi/world?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              World
            </Link>
            <Link
              href={`/bhudhi/identity?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Identity
            </Link>
            <Link
              href={`/bhudhi/organization?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Organization
            </Link>
            <Link
              href={`/bhudhi/teams?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Teams
            </Link>
            <Link
              href={`/bhudhi/experiments?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Experiments
            </Link>
            <Link
              href={`/bhudhi/erector?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Erector
            </Link>
            <Link
              href={`/bhudhi/civilization?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Civilization
            </Link>
            <Link
              href={`/bhudhi/expansion?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Expansion
            </Link>
            <Link
              href={`/bhudhi/kernel?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Kernel
            </Link>
            <Link
              href={`/bhudhi/memory?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Memory
            </Link>
            <Link
              href={`/bhudhi/protocol?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Protocol
            </Link>
            <Link
              href={`/bhudhi/temporal?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Temporal
            </Link>
            <Link
              href={`/bhudhi/governor?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Governor
            </Link>
            <Link
              href={`/bhudhi/reliability?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Reliability
            </Link>
            <Link
              href={`/bhudhi/security?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Security
            </Link>
            <Link
              href={`/bhudhi/infrastructure?blueprintId=${encodeURIComponent(blueprintId)}`}
              className={buttons.secondary}
            >
              Infrastructure
            </Link>
            <Link href="/dashboard" className={buttons.secondary}>
              Dashboard
            </Link>
          </div>
        </header>

        {error && (
          <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>
        )}

        {globalSignal && (
          <div
            className={`mb-8 rounded-xl p-6 sm:p-8 ${getSignalColor(globalSignal)}`}
            data-voice-command="global-signal"
          >
            <div className="text-xs uppercase tracking-widest opacity-90 mb-2">Global signal</div>
            <div className="text-2xl sm:text-3xl font-light mb-2">{getSignalLabel(globalSignal)}</div>
            <div className="text-sm opacity-90">
              Confidence: {formatConfidence(globalConfidence)}
            </div>
            {signals?.interpretation && (
              <p className="text-sm opacity-90 mt-3 leading-relaxed">{signals.interpretation}</p>
            )}
          </div>
        )}

        <nav
          className="flex gap-1 sm:gap-2 mb-8 border-b border-gray-200 overflow-x-auto pb-0"
          aria-label="Bhudhi sections"
        >
          {SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setSelectedSection(section)}
              className={`shrink-0 pb-3 px-3 sm:px-4 font-light text-sm sm:text-base capitalize whitespace-nowrap ${
                selectedSection === section
                  ? "border-b-2 border-gray-900 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {section}
            </button>
          ))}
        </nav>

        {selectedSection === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-xl p-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Systems</div>
                <div className="text-3xl font-light">{status?.systems?.total ?? 5}</div>
                <div className="text-sm text-gray-500 mt-1">{status?.systems?.active ?? 5} active</div>
              </div>
              <div className="border border-gray-200 rounded-xl p-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Engines</div>
                <div className="text-3xl font-light">{status?.engines?.active ?? "—"}</div>
                <div className="text-sm text-gray-500 mt-1">
                  of {status?.engines?.total ?? 47} catalogued
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Frameworks</div>
                <div className="text-3xl font-light">{status?.frameworks?.total ?? 15}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Avg accuracy{" "}
                  {status?.frameworks?.avgAccuracy != null
                    ? `${Math.round(status.frameworks.avgAccuracy * 100)}%`
                    : "—"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttons.primary}
                disabled={!!actionBusy}
                onClick={() =>
                  void runAction("investigate", () => runBhudhiInvestigate(blueprintId))
                }
              >
                {actionBusy === "investigate" ? "Running…" : "Run investigations"}
              </button>
              <button
                type="button"
                className={buttons.secondary}
                disabled={!!actionBusy}
                onClick={() => void runAction("signals", () => refreshSignals())}
              >
                {actionBusy === "signals" ? "Calculating…" : "Calculate signals"}
              </button>
              <button
                type="button"
                className={buttons.secondary}
                disabled={!!actionBusy}
                onClick={() =>
                  void runAction("recommend", () => generateBhudhiRecommendations(blueprintId))
                }
              >
                {actionBusy === "recommend" ? "Generating…" : "Generate recommendations"}
              </button>
              <button
                type="button"
                className={buttons.secondary}
                disabled={!!actionBusy}
                onClick={() =>
                  void runAction("bhudhi20", async () => {
                    const result = await runBhudhiCompleteCycle(blueprintId);
                    setLastCycleStrategy(result?.cycle?.intelligence?.strategy?.selected ?? null);
                  })
                }
              >
                {actionBusy === "bhudhi20" ? "Running Bhudhi 2.0…" : "Run Bhudhi 2.0 cycle"}
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl p-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">
                Bhudhi 2.0 — 8 Torgima AI modules
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {BHUDHI_20_MODULES.map((mod) => (
                  <div key={mod.name} className="border border-gray-100 rounded-lg px-3 py-2">
                    <span className="font-medium">{mod.name}</span>
                    <span className="block text-xs text-gray-500">{mod.system}</span>
                  </div>
                ))}
              </div>
              {lastCycleStrategy && (
                <p className="text-sm text-gray-600 mt-4">
                  Last strategy: <span className="font-medium">{lastCycleStrategy}</span>
                </p>
              )}
            </div>

            {status?.domains?.current && (
              <p className="text-sm text-gray-600">
                Current domain:{" "}
                <span className="font-medium capitalize">{status.domains.current}</span>
              </p>
            )}
          </div>
        )}

        {selectedSection === "systems" && (
          <div className="space-y-3">
            <h2 className="text-xl font-light mb-4">5 core systems</h2>
            {(status?.systems?.systems ?? []).map((sys) => (
              <div
                key={sys.name}
                className="border border-gray-200 rounded-xl p-5 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium capitalize">{sys.name}</div>
                  <div className="text-sm text-gray-500">{sys.engineCount} engines</div>
                </div>
                <span className="text-sm text-emerald-600 font-medium">{sys.status}</span>
              </div>
            ))}
            {status?.engines?.bySystem && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {Object.entries(status.engines.bySystem).map(([key, count]) => (
                  <div key={key} className="border border-gray-100 rounded-lg p-3 capitalize">
                    <span className="text-gray-500">{key}</span>
                    <span className="float-right font-medium">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedSection === "frameworks" && (
          <div>
            <h2 className="text-xl font-light mb-6">Frameworks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-6">
                <div className="text-xs text-gray-500 uppercase mb-3">Team frameworks</div>
                <div className="text-2xl font-light mb-4">{status?.frameworks?.team ?? 14}</div>
                <ul className="space-y-1 text-sm text-gray-600">
                  {TEAM_FRAMEWORK_SAMPLES.map((name) => (
                    <li key={name}>· {name}</li>
                  ))}
                  <li>
                    · + {Math.max(0, (status?.frameworks?.team ?? 14) - TEAM_FRAMEWORK_SAMPLES.length)}{" "}
                    more
                  </li>
                </ul>
              </div>
              <div className="border border-gray-200 rounded-xl p-6">
                <div className="text-xs text-gray-500 uppercase mb-3">Individual</div>
                <div className="text-2xl font-light mb-4">{status?.frameworks?.individual ?? 1}</div>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>· Personal strategy system</li>
                </ul>
              </div>
            </div>

            {signals?.frameworkSignals && Object.keys(signals.frameworkSignals).length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-light mb-4">Framework signals</h3>
                <div className="space-y-2">
                  {Object.entries(signals.frameworkSignals).map(([id, data]) => (
                    <div key={id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{id}</span>
                        <span className="text-gray-600">{data.signal ?? "—"}</span>
                      </div>
                      {data.reasoning && (
                        <p className="text-xs text-gray-500 mt-2">{data.reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedSection === "recommendations" && (
          <div>
            <h2 className="text-xl font-light mb-6">Recommendations</h2>
            <div className="space-y-4">
              {(recommendations?.recommendations ?? []).slice(0, 8).map((rec) => (
                <div key={rec.id} className="border border-gray-200 rounded-xl p-5 sm:p-6">
                  <div className="flex justify-between gap-2 mb-2">
                    <div className="font-medium text-gray-900">{rec.title}</div>
                    <div className="text-sm text-gray-500 shrink-0">
                      {formatConfidence(rec.confidence)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">{rec.reasoning}</p>
                  <button
                    type="button"
                    className={`text-sm ${buttons.primary}`}
                    disabled={!!actionBusy}
                    onClick={() =>
                      void runAction(`exec-${rec.id}`, () =>
                        executeBhudhiRecommendation(rec.id, blueprintId),
                      )
                    }
                  >
                    Execute
                  </button>
                </div>
              ))}
              {(recommendations?.recommendations?.length ?? 0) === 0 && (
                <p className="text-sm text-gray-500">
                  No recommendations yet. Run investigations, then generate recommendations.
                </p>
              )}
            </div>
          </div>
        )}

        {selectedSection === "insights" && (
          <div>
            <h2 className="text-xl font-light mb-6">Insights</h2>
            <div className="space-y-3">
              {(insights?.insights ?? []).slice(0, 12).map((line, i) => (
                <div key={i} className="border-l-4 border-blue-500 pl-4 py-2 text-sm text-gray-700">
                  {line}
                </div>
              ))}
              {(insights?.insights?.length ?? 0) === 0 && (
                <p className="text-sm text-gray-500">No insights yet — run investigations first.</p>
              )}
            </div>
            {(insights?.learnings?.length ?? 0) > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">Recent learnings</h3>
                <ul className="space-y-2 text-sm">
                  {insights!.learnings!.map((l, i) => (
                    <li key={i} className="text-gray-600">
                      {l.framework}: {l.learning} (+{Number(l.improvement).toFixed(2)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {selectedSection === "external" && (
          <div>
            <h2 className="text-xl font-light mb-6">External connections</h2>
            {(connections?.connections?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {connections!.connections!.map((c) => (
                  <div
                    key={c.id}
                    className="border border-gray-200 rounded-xl p-5 flex justify-between"
                  >
                    <div>
                      <div className="font-medium">{c.systemName}</div>
                      <div className="text-sm text-gray-500 capitalize">{c.systemType}</div>
                    </div>
                    <span className="text-sm text-emerald-600">{c.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-8 text-center text-gray-600">
                <p>No external systems connected yet.</p>
                <p className="text-xs mt-2 text-gray-400">
                  Use POST /api/bhudhi/external/connect from settings or API tools.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
          <div
            className="flex-1 max-w-xl"
            data-voice-command="ask-bhudhi"
          >
            <label htmlFor="bhudhi-voice" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Mic className="w-4 h-4" aria-hidden />
              Ask Bhudhi
            </label>
            <input
              id="bhudhi-voice"
              type="text"
              value={voiceQuery}
              onChange={(e) => setVoiceQuery(e.target.value)}
              placeholder="Ask anything about your execution…"
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--torgima-primary)]"
              aria-label="Voice-ready query for Bhudhi"
            />
            <p className="text-[10px] text-gray-400 mt-1">Voice command ready · press Enter to save locally</p>
          </div>
          <p className="text-xs text-gray-400">
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
