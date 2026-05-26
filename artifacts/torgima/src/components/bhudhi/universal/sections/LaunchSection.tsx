import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  fetchBhudhiLaunchConfig,
  fetchBhudhiLaunchStatus,
  type BhudhiLaunchConfig,
} from "@/lib/bhudhi-launch-api";

export function LaunchSection({ blueprintId }: { blueprintId: string }) {
  const [config, setConfig] = useState<BhudhiLaunchConfig | null>(null);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, st] = await Promise.all([
        fetchBhudhiLaunchConfig(),
        fetchBhudhiLaunchStatus(),
      ]);
      setConfig(cfg);
      setStatus(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load launch config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, blueprintId]);

  if (loading && !config) {
    return <p className="text-sm text-gray-500">Loading launch configuration…</p>;
  }

  if (error && !config) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-light mb-2">Bhudhi Launch</h1>
        <p className="text-gray-600 text-sm">
          Environment, pricing tiers, telemetry, and deployment readiness (Prompt 40).
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-medium">Environment</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">Name</dt>
          <dd className="font-mono">{config.environment.name}</dd>
          <dt className="text-gray-500">API URL</dt>
          <dd className="font-mono truncate">{config.environment.apiUrl}</dd>
          <dt className="text-gray-500">Telemetry</dt>
          <dd>
            {config.environment.telemetry.enabled
              ? `enabled (${config.environment.telemetry.sampleRate * 100}% sample)`
              : "disabled"}
          </dd>
        </dl>
        <div className="flex flex-wrap gap-2 pt-2">
          {Object.entries(config.environment.features).map(([k, v]) => (
            <span
              key={k}
              className={`text-xs px-2 py-1 rounded ${
                v ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
              }`}
            >
              {k}: {v ? "on" : "off"}
            </span>
          ))}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Pricing tiers</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {config.pricing.map((tier) => (
            <div key={tier.id} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium">{tier.name}</h3>
              <p className="text-2xl font-light mt-1">
                {tier.monthlyPrice === 0 ? "Free" : `$${tier.monthlyPrice}/mo`}
              </p>
              <p className="text-xs text-gray-500 mt-2">Torgima: {tier.torgimaTier}</p>
              <p className="text-sm text-gray-600 mt-2">{tier.description}</p>
              <ul className="text-xs text-gray-500 mt-3 space-y-1">
                <li>{tier.limits.blueprints as number} blueprints</li>
                <li>{tier.limits.monthlyExecutions as number} executions/mo</li>
              </ul>
            </div>
          ))}
        </div>
      </div>

      {status && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 text-sm">
          <p className="font-medium text-blue-900">
            Launch status: {(status.status as string) ?? "unknown"}
          </p>
          <p className="text-blue-800 mt-1">{(status.insight as string) ?? ""}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href="/app/bhudhi/onboarding"
          className="text-slate-800 underline hover:no-underline"
        >
          Complete Bhudhi onboarding →
        </Link>
        <a
          href="https://github.com/Tornicles/Torgima-Execution/blob/main/docs/DEPLOYMENT_CHECKLIST.md"
          target="_blank"
          rel="noreferrer"
          className="text-slate-800 underline hover:no-underline"
        >
          Pre-launch runbook
        </a>
      </div>
    </div>
  );
}
