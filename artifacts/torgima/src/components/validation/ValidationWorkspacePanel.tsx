import { useState } from "react";
import { apiFetchEnvelope } from "@/lib/torgima-api";

type Section = {
  id: string;
  title: string;
  sequenceStage: number;
  content: Record<string, unknown>;
  pendingChange?: boolean;
  userEdits?: string[];
};

export function ValidationWorkspacePanel({ validationId }: { validationId: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [editDraft, setEditDraft] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [paths, setPaths] = useState<{
    foundation?: Record<string, unknown>;
    momentum?: Record<string, unknown>;
    overdrive?: Record<string, unknown>;
  }>({});
  const [finalized, setFinalized] = useState(false);

  async function load() {
    const res = await apiFetchEnvelope<{
      workspace: { sections: Section[] };
      path_foundation?: Record<string, unknown>;
      path_momentum?: Record<string, unknown>;
      path_overdrive?: Record<string, unknown>;
      finalized?: boolean;
    }>(`/api/v1/validation/${validationId}/workspace`);
    if (res.ok && res.data) {
      if (res.data.workspace?.sections) setSections(res.data.workspace.sections);
      setPaths({
        foundation: res.data.path_foundation,
        momentum: res.data.path_momentum,
        overdrive: res.data.path_overdrive,
      });
      setFinalized(Boolean(res.data.finalized));
    }
  }

  async function selectPath(path: "foundation" | "momentum" | "overdrive") {
    setLoading(true);
    const res = await apiFetchEnvelope(`/api/v1/validation/${validationId}/select-path`, {
      method: "POST",
      body: JSON.stringify({ path }),
    });
    setLoading(false);
    if (res.ok) setMessage(`Selected ${path} path`);
  }

  async function applyEdit(sectionId: string) {
    if (!editDraft.trim()) return;
    setLoading(true);
    await apiFetchEnvelope(`/api/v1/validation/${validationId}/workspace/edit`, {
      method: "POST",
      body: JSON.stringify({ sectionId, action: "add", content: editDraft.trim() }),
    });
    setEditDraft("");
    setActiveSection(null);
    await load();
    setLoading(false);
  }

  async function updateValidation() {
    setLoading(true);
    setMessage("");
    const res = await apiFetchEnvelope<{ updated: boolean; triggers?: string[] }>(
      `/api/v1/validation/${validationId}/workspace/update`,
      { method: "POST", body: JSON.stringify({}) },
    );
    setLoading(false);
    if (res.ok) {
      setMessage(res.data?.updated ? `Recalculated (${res.data.triggers?.join(", ") ?? "sections"})` : "No pending changes");
      await load();
    }
  }

  async function finalize() {
    setLoading(true);
    await apiFetchEnvelope(`/api/v1/validation/${validationId}/workspace/finalize`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setLoading(false);
    setFinalized(true);
    setMessage("Validation finalized and locked for blueprint handoff.");
    await load();
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Validation workspace (20 sections)</h3>
        <div className="flex gap-2">
          <button type="button" className="text-sm underline" onClick={() => void load()}>
            Refresh
          </button>
          <button
            type="button"
            className="rounded-md bg-secondary px-3 py-1 text-sm"
            disabled={loading}
            onClick={() => void updateValidation()}
          >
            Update validation
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
            disabled={loading}
            onClick={() => void finalize()}
          >
            Finalize
          </button>
        </div>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {finalized && (paths.foundation || paths.momentum || paths.overdrive) ? (
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              ["foundation", "Foundation", paths.foundation],
              ["momentum", "Momentum", paths.momentum],
              ["overdrive", "Overdrive", paths.overdrive],
            ] as const
          ).map(([key, label, data]) =>
            data ? (
              <div key={key} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{label}</p>
                <pre className="mt-2 max-h-28 overflow-auto text-xs text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(data, null, 2).slice(0, 400)}
                </pre>
                <button
                  type="button"
                  className="mt-2 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                  disabled={loading}
                  onClick={() => void selectPath(key)}
                >
                  Select {label}
                </button>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">Load workspace after Erector validation completes.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sections.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border p-3 text-sm ${s.pendingChange ? "border-amber-500/50" : "border-border"}`}
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">
                  {s.sequenceStage}. {s.title}
                </span>
                {s.pendingChange ? <span className="text-xs text-amber-600">Pending</span> : null}
              </div>
              <pre className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(s.content, null, 2).slice(0, 600)}
              </pre>
              <button
                type="button"
                className="mt-2 text-xs text-primary underline"
                onClick={() => setActiveSection(s.id)}
              >
                Add note
              </button>
              {activeSection === s.id && (
                <div className="mt-2 space-y-2">
                  <input
                    className="w-full rounded border px-2 py-1 text-xs"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    placeholder="e.g. Include WhatsApp community"
                  />
                  <button
                    type="button"
                    className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
                    onClick={() => void applyEdit(s.id)}
                  >
                    Save edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
