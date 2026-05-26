import { useCallback, useEffect, useState } from "react";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { MetricStatCard, MetricStatRow } from "@/components/design-system/MetricStatRow";
import { cards, buttons, PageEmpty, PageLoading } from "@/design";
import { apiGet, apiPost } from "@/lib/torgima-api";

type Tab = "predictions" | "scene" | "validation" | "emergency";

type Accuracy = {
  accuracy: number;
  correct: number;
  total_predictions: number;
  recent_accuracy: number;
};

type SceneRow = {
  id: string;
  current_vs_expected: number;
  expected_vs_ideal: number;
  blocker_gaps: string[];
  opportunity_gaps: string[];
  current_state?: { current_scene_text?: string };
  expected_state?: { expected_scene_text?: string };
};

type ValidationCheckpoint = {
  id: string;
  execution_valid: boolean;
  prediction_valid: boolean;
  validation_errors: string[];
  warnings: string[];
  recovery_needed: boolean;
  recovery_type?: string | null;
  created_at: string;
};

type EmergencyOrder = {
  id: string;
  task_description: string;
  urgency: string;
  order_type: string;
  estimated_impact: string;
  linked_order_id?: string | null;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "predictions", label: "Predictions" },
  { id: "scene", label: "Scene" },
  { id: "validation", label: "Validation" },
  { id: "emergency", label: "Emergency" },
];

export function UltimateIntelligenceView({ initialTab = "predictions" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accuracy, setAccuracy] = useState<Accuracy | null>(null);
  const [scene, setScene] = useState<SceneRow | null>(null);
  const [checkpoints, setCheckpoints] = useState<ValidationCheckpoint[]>([]);
  const [emergency, setEmergency] = useState<EmergencyOrder[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLocked(false);
    try {
      if (tab === "predictions") {
        const data = await apiGet<Accuracy>("/api/v1/ultimate/predictions");
        setAccuracy(data);
      } else if (tab === "scene") {
        const data = await apiGet<SceneRow | null>("/api/v1/ultimate/scene");
        setScene(data);
      } else if (tab === "validation") {
        const data = await apiGet<{ checkpoints: ValidationCheckpoint[] }>(
          "/api/v1/ultimate/validation",
        );
        setCheckpoints(data.checkpoints ?? []);
      } else {
        const data = await apiGet<{ orders: EmergencyOrder[] }>("/api/v1/ultimate/emergency");
        setEmergency(data.orders ?? []);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ultimate features unavailable";
      if (msg.toLowerCase().includes("403") || msg.toLowerCase().includes("disabled")) {
        setLocked(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshScene() {
    setBusy(true);
    try {
      const data = await apiPost<{ scene: SceneRow }>("/api/v1/ultimate/scene", {});
      setScene(data.scene);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh scene");
    } finally {
      setBusy(false);
    }
  }

  async function runValidation() {
    setBusy(true);
    try {
      await apiPost("/api/v1/ultimate/validation", {});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setBusy(false);
    }
  }

  async function generatePrediction() {
    setBusy(true);
    try {
      await apiPost("/api/v1/ultimate/predictions", { action: "generate" });
      const data = await apiGet<Accuracy>("/api/v1/ultimate/predictions");
      setAccuracy(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate prediction");
    } finally {
      setBusy(false);
    }
  }

  async function completeEmergency(id: string) {
    await apiPost("/api/v1/ultimate/emergency/complete", {
      emergencyOrderId: id,
      effectiveness: 0.8,
    });
    await load();
  }

  if (loading) return <PageLoading />;

  if (locked) {
    return (
      <DashboardPageLayout
        title="Ultimate Intelligence"
        subtitle="Unlocks at Sequence 25 on Ultimate tier (after Growth completes)."
      >
        <PageEmpty
          title="Ultimate features locked"
          description="Complete Growth sequence 24 and use an Ultimate blueprint to access predictions, scene analysis, continuous validation, and emergency orders."
        />
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      title="Ultimate Intelligence"
      subtitle="Sequence 25 — predictions, scene, validation, and emergency response."
      headerRight={
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? buttons.primary
                  : "px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}

      {tab === "predictions" && (
        <div className="space-y-4">
          <MetricStatRow>
            <MetricStatCard
              label="Prediction accuracy"
              value={accuracy ? `${(accuracy.accuracy * 100).toFixed(1)}%` : "—"}
              sub={
                accuracy
                  ? `${accuracy.correct} / ${accuracy.total_predictions} validated`
                  : "No data yet"
              }
            />
            <MetricStatCard
              label="Recent accuracy"
              value={accuracy ? `${(accuracy.recent_accuracy * 100).toFixed(1)}%` : "—"}
              sub="Last 10 predictions"
            />
          </MetricStatRow>
          <button
            type="button"
            className={buttons.primary}
            disabled={busy}
            onClick={() => void generatePrediction()}
          >
            Generate next prediction
          </button>
        </div>
      )}

      {tab === "scene" && (
        <div className="space-y-4">
          <button
            type="button"
            className={buttons.primary}
            disabled={busy}
            onClick={() => void refreshScene()}
          >
            Capture scene snapshot
          </button>
          {!scene ? (
            <PageEmpty title="No scene yet" description="Capture a snapshot to compare current vs expected vs ideal." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className={cards.padded}>
                <h2 className="font-semibold">Divergence</h2>
                <p className="text-2xl font-bold mt-2">
                  {(scene.current_vs_expected * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-500 mt-1">Current vs expected</p>
              </div>
              <div className={cards.padded}>
                <h2 className="font-semibold">Headroom</h2>
                <p className="text-2xl font-bold mt-2">
                  {(scene.expected_vs_ideal * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-500 mt-1">Expected vs ideal</p>
              </div>
              <div className={`${cards.padded} md:col-span-2`}>
                <p className="text-sm font-medium text-gray-700">Current</p>
                <p className="text-sm mt-1">{scene.current_state?.current_scene_text ?? "—"}</p>
                <p className="text-sm font-medium text-gray-700 mt-3">Expected</p>
                <p className="text-sm mt-1">{scene.expected_state?.expected_scene_text ?? "—"}</p>
                {scene.blocker_gaps?.length ? (
                  <ul className="mt-3 text-sm text-red-700 list-disc pl-5">
                    {scene.blocker_gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                ) : null}
                {scene.opportunity_gaps?.length ? (
                  <ul className="mt-3 text-sm text-emerald-800 list-disc pl-5">
                    {scene.opportunity_gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "validation" && (
        <div className="space-y-4">
          <button
            type="button"
            className={buttons.primary}
            disabled={busy}
            onClick={() => void runValidation()}
          >
            Run validation checkpoint
          </button>
          {checkpoints.length === 0 ? (
            <PageEmpty title="No checkpoints" description="Run validation after feedback or on demand." />
          ) : (
            checkpoints.map((c) => (
              <div key={c.id} className={cards.padded}>
                <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</p>
                <p className="font-medium mt-1">
                  {c.execution_valid && c.prediction_valid ? "Valid" : "Issues detected"}
                  {c.recovery_needed ? " · Recovery needed" : ""}
                </p>
                {c.validation_errors.map((e) => (
                  <p key={e} className="text-sm text-red-700 mt-1">
                    {e}
                  </p>
                ))}
                {c.warnings.map((w) => (
                  <p key={w} className="text-sm text-amber-700 mt-1">
                    {w}
                  </p>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "emergency" && (
        <div className="space-y-4">
          {emergency.length === 0 ? (
            <PageEmpty title="No emergency orders" description="System creates these when blockers or recovery are detected." />
          ) : (
            emergency.map((o) => (
              <div key={o.id} className={cards.padded}>
                <p className="text-xs uppercase text-red-600 font-bold">{o.urgency}</p>
                <p className="font-medium mt-1">{o.task_description}</p>
                <p className="text-sm text-gray-600 mt-1">{o.estimated_impact}</p>
                <p className="text-xs text-gray-400 mt-1">{o.order_type}</p>
                <button
                  type="button"
                  className={`${buttons.primary} mt-3`}
                  onClick={() => void completeEmergency(o.id)}
                >
                  Mark addressed
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </DashboardPageLayout>
  );
}
