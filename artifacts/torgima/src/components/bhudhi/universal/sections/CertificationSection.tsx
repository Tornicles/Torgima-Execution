import { useCallback, useEffect, useState } from "react";
import {
  fetchBhudhiCertification,
  type BhudhiCertificationPayload,
} from "@/lib/bhudhi-certification-api";

function categoryColor(category: string): string {
  switch (category) {
    case "enterprise":
      return "text-green-600";
    case "production":
      return "text-blue-600";
    case "partial":
      return "text-yellow-600";
    case "not-ready":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

function categoryBorder(category: string): string {
  switch (category) {
    case "enterprise":
      return "border-green-200 bg-green-50";
    case "production":
      return "border-blue-200 bg-blue-50";
    case "partial":
      return "border-yellow-200 bg-yellow-50";
    case "not-ready":
      return "border-red-200 bg-red-50";
    default:
      return "border-gray-200";
  }
}

export function CertificationSection({ blueprintId }: { blueprintId: string }) {
  const [cert, setCert] = useState<BhudhiCertificationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBhudhiCertification();
      setCert(data.certification);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load certification");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, blueprintId]);

  if (loading && !cert) {
    return <p className="text-sm text-gray-500">Loading certification…</p>;
  }

  if (error && !cert) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!cert) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-light mb-2">Bhudhi Readiness Certification</h1>
        <p className="text-gray-600 text-sm">
          BRS scorecard · 0–40 not ready · 40–70 partial · 70–85 production · 85+ enterprise
        </p>
      </div>

      <div className={`border rounded-lg p-8 ${categoryBorder(cert.category)}`}>
        <div className="text-center">
          <div className="text-6xl font-light mb-2">{cert.overall}</div>
          <div className={`text-xl font-medium capitalize ${categoryColor(cert.category)}`}>
            {cert.category.replace("-", " ")}
          </div>
          <p className="text-sm text-gray-600 mt-2">{cert.brsLabel}</p>
          <p className="text-xs text-gray-500 mt-1 font-mono">v{cert.version}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {cert.scores.map((score) => (
          <div key={score.category} className="border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium">{score.category}</h3>
              <span className="text-2xl font-light">{Math.round(score.score)}</span>
            </div>
            <ul className="space-y-2 text-sm">
              {score.criteria.map((c, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-gray-600">{c.name}</span>
                  <span className={c.passed ? "text-green-600 shrink-0" : "text-red-600 shrink-0"}>
                    {c.passed ? "✓" : "✗"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {cert.recommendations.length > 0 && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Recommendations</h2>
          <ul className="space-y-1 text-sm">
            {cert.recommendations.map((rec, i) => (
              <li key={i}>• {rec}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Next steps</h2>
        <ol className="space-y-2 text-sm list-decimal list-inside">
          {cert.nextSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            const blob = new Blob([JSON.stringify(cert, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bhudhi-certification-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="px-5 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
        >
          Re-run certification
        </button>
      </div>
    </div>
  );
}
