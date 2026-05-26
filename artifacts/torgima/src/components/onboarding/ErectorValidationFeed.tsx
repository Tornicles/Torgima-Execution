import { useEffect, useState } from "react";
import { apiFetchEnvelope } from "@/lib/torgima-api";
import { saveValidationFeed } from "@/lib/erector-refinement-api";

const BUSINESS_TYPES = [
  "Mobile App",
  "SaaS",
  "Content",
  "Service",
  "Marketplace",
  "Education",
  "Fitness",
  "Ecommerce",
  "Agency",
  "Community",
  "Physical Product",
  "Other",
];

export function ErectorValidationFeed({
  blueprintId,
  goalFinal,
  purposeFinal,
  onSubmitted,
}: {
  blueprintId: string;
  goalFinal: string;
  purposeFinal: string;
  onSubmitted: () => void;
}) {
  const [country, setCountry] = useState("United States");
  const [economicType, setEconomicType] = useState("");
  const [businessType, setBusinessType] = useState("Mobile App");
  const [businessModel, setBusinessModel] = useState("Subscription / Freemium");
  const [commitment, setCommitment] = useState("Part-time");
  const [budget, setBudget] = useState("3000");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [resources, setResources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (country.trim().length < 2) return;
    void apiFetchEnvelope<{ economicType: string }>(
      `/api/v1/blueprints/goal/economic-type?country=${encodeURIComponent(country)}`,
    ).then((res) => {
      if (res.ok && res.data?.economicType) setEconomicType(res.data.economicType);
    });
  }, [country]);

  async function submit() {
    setLoading(true);
    setError("");
    const res = await saveValidationFeed(blueprintId, {
      goal_final: goalFinal,
      purpose_final: purposeFinal,
      country,
      economic_type: economicType,
      business_type: businessType,
      business_model: businessModel,
      commitment_level: commitment,
      budget: Number(budget) || 0,
      resources,
      target_customer: targetCustomer,
      timeframe: { duration_days: 90 },
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Could not save validation feed");
      return;
    }
    onSubmitted();
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Validation context</h2>
      <p className="text-sm text-muted-foreground">Read-only finalized goal and purpose; add market context for the 20-stage run.</p>
      <div className="grid gap-3 md:grid-cols-2 text-sm">
        <div>
          <span className="font-medium">Goal (final)</span>
          <p className="text-muted-foreground">{goalFinal}</p>
        </div>
        <div>
          <span className="font-medium">Purpose (final)</span>
          <p className="text-muted-foreground">{purposeFinal}</p>
        </div>
      </div>
      <label className="block text-sm font-medium">Country</label>
      <input className="w-full rounded-md border px-3 py-2 text-sm" value={country} onChange={(e) => setCountry(e.target.value)} />
      {economicType ? (
        <p className="text-xs text-emerald-700">Economy type: {economicType}</p>
      ) : null}
      <label className="block text-sm font-medium">Business type</label>
      <select className="w-full rounded-md border px-3 py-2 text-sm" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
        {BUSINESS_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <label className="block text-sm font-medium">Business model</label>
      <input className="w-full rounded-md border px-3 py-2 text-sm" value={businessModel} onChange={(e) => setBusinessModel(e.target.value)} />
      <label className="block text-sm font-medium">Target customer</label>
      <textarea className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm" value={targetCustomer} onChange={(e) => setTargetCustomer(e.target.value)} />
      <label className="block text-sm font-medium">Budget (USD)</label>
      <input className="w-full rounded-md border px-3 py-2 text-sm" value={budget} onChange={(e) => setBudget(e.target.value)} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="button"
        disabled={loading || !targetCustomer.trim()}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        onClick={() => void submit()}
      >
        {loading ? "Saving…" : "Start validation"}
      </button>
    </div>
  );
}
