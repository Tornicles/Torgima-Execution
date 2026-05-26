import { Link } from "wouter";
import { useBlueprintStore } from "@/store/blueprintStore";
import { bhudhiPath } from "@/hooks/useBhudhiBlueprint";

export function SettingsSection({ blueprintId }: { blueprintId: string }) {
  const setActiveBlueprint = useBlueprintStore((s) => s.setActiveBlueprintId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-light mb-2">Settings</h1>
        <p className="text-gray-600">Blueprint and Bhudhi configuration</p>
      </div>

      <div className="border border-gray-200 rounded-lg p-6 space-y-4 text-sm">
        <div>
          <div className="text-gray-600 mb-1">Active blueprint</div>
          <code className="text-xs bg-gray-50 px-2 py-1 rounded block break-all">
            {blueprintId || "None selected"}
          </code>
        </div>

        <div>
          <label className="text-gray-600 block mb-2">Set blueprint ID (session)</label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const id = String(fd.get("blueprintId") ?? "").trim();
              if (id) setActiveBlueprint(id);
            }}
          >
            <input
              name="blueprintId"
              type="text"
              defaultValue={blueprintId}
              placeholder="UUID"
              className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm font-mono"
            />
            <button type="submit" className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
              Apply
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <h2 className="text-lg font-medium">Links</h2>
        <ul className="space-y-2 text-gray-700">
          <li>
            <Link href="/dashboard" className="underline">
              Main Torgima dashboard
            </Link>
          </li>
          <li>
            <Link href="/settings" className="underline">
              Account settings
            </Link>
          </li>
          <li>
            <Link
              href={`/console/governance?blueprintId=${encodeURIComponent(blueprintId)}`}
              className="underline"
            >
              Governance console
            </Link>
          </li>
          <li>
            <Link href={bhudhiPath("", blueprintId)} className="underline">
              Bhudhi overview
            </Link>
          </li>
        </ul>
      </div>

      <div className="border border-gray-200 rounded-lg p-6 text-sm text-gray-600">
        <p>
          External integrations use <code className="text-xs">POST /api/bhudhi/external/connect</code>.
          Signal refresh runs from the Governance section.
        </p>
      </div>
    </div>
  );
}
