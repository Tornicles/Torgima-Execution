import { useState } from "react";
import { Pencil } from "lucide-react";
import { getProjectDisplayName } from "@/lib/language";
import { validateProjectNameInput } from "@/lib/project-name";
import { updateBlueprintProjectName } from "@/lib/torgima-api";
import { TOASTS } from "@/lib/toasts";
import { toast } from "sonner";

export function ProjectNameHeader({
  blueprintId,
  projectName,
  goal,
  onUpdated,
}: {
  blueprintId?: string | null;
  projectName?: string | null;
  goal?: string | null;
  onUpdated?: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const display = getProjectDisplayName(projectName, goal);

  async function save() {
    const err = validateProjectNameInput(draft);
    if (err) {
      setError(err);
      return;
    }
    if (!blueprintId) {
      setEditing(false);
      onUpdated?.(draft.trim());
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await updateBlueprintProjectName(blueprintId, draft.trim());
      onUpdated?.(res.projectName);
      toast.success(TOASTS.nameUpdated);
      setEditing(false);
    } catch {
      setError("Could not save the name. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-[20px] border border-[#E8ECF0] bg-white p-5 shadow-sm space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Project</p>
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value.slice(0, 50));
            if (error) setError("");
          }}
          maxLength={50}
          className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-lg font-bold text-[#0F172A] outline-none focus:border-[#5B21FF] focus:ring-2 focus:ring-[#5B21FF]/15"
          autoFocus
        />
        <p className="text-right text-xs text-[#94A3B8]">{draft.length} / 50</p>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-[#5B21FF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(projectName ?? "");
              setEditing(false);
              setError("");
            }}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-semibold text-[#64748B]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Project</p>
        <h1 className="text-2xl sm:text-[28px] font-bold text-[#0F172A] mt-1">{display}</h1>
      </div>
      <button
        type="button"
        onClick={() => {
          setDraft(projectName ?? display);
          setEditing(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
      >
        <Pencil className="h-4 w-4" />
        Rename
      </button>
    </div>
  );
}
