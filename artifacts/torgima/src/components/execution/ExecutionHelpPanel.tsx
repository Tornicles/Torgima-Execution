import { useState } from "react";
import { Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";
import { IntelligencePanel } from "@/components/bhudhi/IntelligencePanel";

export function ExecutionHelpPanel({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);

  async function loadHelp() {
    if (!API_BASE_URL) return;
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/execution/help`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: {
          help?: { steps?: string[]; tools?: string[]; explanation?: string };
          steps?: string[];
          tools?: string[];
          content?: string;
        };
      };
      if (json.ok && json.data) {
        const packet = json.data.help;
        const rawSteps = packet?.steps ?? json.data.steps ?? [];
        setSteps(rawSteps.slice(0, 5));
        setTools(packet?.tools ?? json.data.tools ?? []);
        const text = packet?.explanation ?? json.data.content;
        if (!rawSteps.length && text) {
          setSteps(text.split(/\n+/).filter(Boolean).slice(0, 5));
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => void loadHelp()}
        className="text-sm font-medium text-green-700 border border-green-200 rounded-xl px-4 py-2 hover:bg-green-50"
      >
        Request execution help
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-5 space-y-4 bg-gray-50">
      <p className="text-xs font-semibold uppercase text-gray-500">Step-by-step guidance</p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading execution help…
        </div>
      ) : steps.length > 0 ? (
        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-800">
          {steps.map((s, i) => (
            <li key={`${i}-${s.slice(0, 20)}`}>{s}</li>
          ))}
        </ol>
      ) : (
        <IntelligencePanel
          type="explanation"
          content="Break the Order into three concrete actions: prepare context, execute the core output, verify against definition of done."
          confidenceTier="LOW"
        />
      )}
      {tools.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Suggested tools</p>
          <ul className="text-sm text-gray-700 list-disc pl-5">
            {tools.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
