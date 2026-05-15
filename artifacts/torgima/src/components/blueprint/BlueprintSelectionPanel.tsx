import { useEffect, useState } from "react";
import { Check, Users, User, Zap, TrendingUp, Crown } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

export type TierId = "starter" | "growth" | "ultimate";
export type ModeId = "individual" | "team";

interface CatalogTier {
  id: TierId;
  label: string;
  tagline: string;
  intelligenceDepth: string;
  includes: string[];
  excludes: string[];
  executionDepth: string;
  strategicImplication: string;
}

interface CatalogMode {
  id: ModeId;
  label: string;
  tagline: string;
  changes: string[];
  notThis: string;
}

interface SelectionCatalog {
  tiers: CatalogTier[];
  modes: CatalogMode[];
}

const TIER_ICONS: Record<TierId, typeof Zap> = {
  starter: Zap,
  growth: TrendingUp,
  ultimate: Crown,
};

const DEPTH_LABEL: Record<string, string> = {
  guided: "Guided depth",
  operational: "Operational depth",
  strategic: "Strategic depth",
};

interface BlueprintSelectionPanelProps {
  selectedTier: TierId | null;
  selectedMode: ModeId | null;
  onTierChange: (tier: TierId) => void;
  onModeChange: (mode: ModeId) => void;
  disabled?: boolean;
}

export function BlueprintSelectionPanel({
  selectedTier,
  selectedMode,
  onTierChange,
  onModeChange,
  disabled,
}: BlueprintSelectionPanelProps) {
  const [catalog, setCatalog] = useState<SelectionCatalog | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!API_BASE_URL) return;
    void fetch(`${API_BASE_URL}/api/blueprints/selection-catalog`, { credentials: "include" })
      .then((r) => r.json())
      .then((body: { ok?: boolean; data?: SelectionCatalog }) => {
        if (body.ok && body.data) setCatalog(body.data);
        else setLoadError("Could not load blueprint options.");
      })
      .catch(() => setLoadError("Could not load blueprint options."));
  }, []);

  const tiers = catalog?.tiers ?? [];
  const modes = catalog?.modes ?? [];
  const activeTier = tiers.find((t) => t.id === selectedTier);
  const activeMode = modes.find((m) => m.id === selectedMode);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold text-gray-900">Choose your blueprint type</h2>
        <p className="text-sm text-gray-600 mt-1">
          Structure stays fixed. Tier changes depth and intelligence. Mode changes how execution is
          distributed. You must confirm before the blueprint can launch.
        </p>
        {loadError && <p className="text-sm text-red-600 mt-2">{loadError}</p>}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Tier</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => {
            const Icon = TIER_ICONS[tier.id];
            const selected = selectedTier === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                disabled={disabled}
                onClick={() => onTierChange(tier.id)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  selected
                    ? "border-green-600 bg-green-50 ring-2 ring-green-200"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-green-700" />
                    <span className="font-bold text-gray-900">{tier.label}</span>
                  </div>
                  {selected && <Check className="w-5 h-5 text-green-600" />}
                </div>
                <p className="text-xs font-medium text-green-800 mb-2">{tier.tagline}</p>
                <p className="text-xs text-gray-600 mb-2">
                  {DEPTH_LABEL[tier.intelligenceDepth] ?? tier.intelligenceDepth}
                </p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {tier.includes.slice(0, 3).map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        {activeTier && (
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
            <p>
              <span className="font-semibold">Execution depth:</span> {activeTier.executionDepth}
            </p>
            <p>
              <span className="font-semibold">Strategic implication:</span>{" "}
              {activeTier.strategicImplication}
            </p>
            {activeTier.excludes.length > 0 && (
              <p className="text-gray-500">
                <span className="font-semibold">Locked at this tier:</span>{" "}
                {activeTier.excludes.join("; ")}
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Mode</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {modes.map((mode) => {
            const selected = selectedMode === mode.id;
            const Icon = mode.id === "team" ? Users : User;
            return (
              <button
                key={mode.id}
                type="button"
                disabled={disabled}
                onClick={() => onModeChange(mode.id)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  selected
                    ? "border-green-600 bg-green-50 ring-2 ring-green-200"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-green-700" />
                    <span className="font-bold text-gray-900">{mode.label}</span>
                  </div>
                  {selected && <Check className="w-5 h-5 text-green-600" />}
                </div>
                <p className="text-xs text-gray-600 mb-2">{mode.tagline}</p>
                <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1">{mode.notThis}</p>
              </button>
            );
          })}
        </div>
        {activeMode && (
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700">
            <ul className="space-y-1">
              {activeMode.changes.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
