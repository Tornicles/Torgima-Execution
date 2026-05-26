import {
  db,
  bhudhiSystems,
  bhudhiEngines,
  bhudhiFrameworks,
  bhudhiDomains,
  bhudhiSignals,
  bhudhiInvestigations,
  bhudhiFrameworkLearning,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { domainsService } from "../domains/DomainsService.js";

export async function getBhudhiHealth() {
  const [systems, engines, frameworks] = await Promise.all([
    db.select({ id: bhudhiSystems.id }).from(bhudhiSystems),
    db.select({ id: bhudhiEngines.id }).from(bhudhiEngines),
    db.select({ id: bhudhiFrameworks.id }).from(bhudhiFrameworks),
  ]);

  const healthy = systems.length > 0 && engines.length > 0;

  return {
    success: healthy,
    status: healthy ? "healthy" : "unhealthy",
    components: {
      database: systems.length > 0 ? "ok" : "error",
      systems: systems.length,
      engines: engines.length,
      frameworks: frameworks.length,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function getBhudhiStatus(blueprintId?: string) {
  const [systems, engines, frameworks, domains] = await Promise.all([
    db.select().from(bhudhiSystems),
    db.select().from(bhudhiEngines),
    db.select().from(bhudhiFrameworks).where(eq(bhudhiFrameworks.status, "active")),
    db.select().from(bhudhiDomains),
  ]);

  const activeEngines = engines.filter((e) => e.status === "active");

  let signals: {
    global: string | null;
    confidence: number | null;
    blueprintId: string | null;
  } = { global: null, confidence: null, blueprintId: null };

  let currentDomain: string | null = null;

  if (blueprintId) {
    const [signal] = await db
      .select()
      .from(bhudhiSignals)
      .where(eq(bhudhiSignals.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiSignals.created_at))
      .limit(1);

    if (signal) {
      signals = {
        global: signal.global_signal,
        confidence: signal.global_signal_confidence,
        blueprintId: signal.blueprint_id,
      };
    }
    currentDomain = await domainsService.getCurrentDomain(blueprintId);
  }

  const avgAccuracy =
    frameworks.length > 0
      ? frameworks.reduce((sum, f) => sum + Number(f.accuracy), 0) / frameworks.length
      : 0;

  return {
    success: true,
    systems: {
      total: systems.length,
      active: systems.filter((s) => s.status === "active").length,
      systems: systems.map((s) => ({
        name: s.name,
        status: s.status,
        engineCount: s.engine_count,
      })),
    },
    engines: {
      total: engines.length,
      active: activeEngines.length,
      bySystem: {
        investigation: engines.filter((e) => e.type === "investigation").length,
        intelligence: engines.filter((e) => e.type === "intelligence").length,
        operating: engines.filter((e) => e.type === "operating").length,
        preservation: engines.filter((e) => e.type === "preservation").length,
        security: engines.filter((e) => e.system_id === "security").length,
      },
    },
    frameworks: {
      total: frameworks.length,
      team: frameworks.filter((f) => f.type === "team").length,
      individual: frameworks.filter((f) => f.type === "individual").length,
      avgAccuracy: Math.round(avgAccuracy * 1000) / 1000,
    },
    domains: {
      total: domains.length,
      current: currentDomain,
    },
    signals,
  };
}

export async function getBhudhiInsights(blueprintId: string) {
  const investigations = await db
    .select({ findings: bhudhiInvestigations.findings })
    .from(bhudhiInvestigations)
    .where(eq(bhudhiInvestigations.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiInvestigations.created_at))
    .limit(10);

  const insights: string[] = [];
  for (const inv of investigations) {
    const findings = inv.findings as { insights?: string[] };
    if (Array.isArray(findings?.insights)) {
      insights.push(...findings.insights);
    }
  }

  const learnings = await db
    .select({
      frameworkId: bhudhiFrameworkLearning.framework_id,
      learningType: bhudhiFrameworkLearning.learning_type,
      improvement: bhudhiFrameworkLearning.improvement,
    })
    .from(bhudhiFrameworkLearning)
    .where(eq(bhudhiFrameworkLearning.status, "validated"))
    .orderBy(desc(bhudhiFrameworkLearning.created_at))
    .limit(5);

  return {
    success: true,
    insights,
    learnings: learnings.map((l) => ({
      framework: l.frameworkId,
      learning: l.learningType,
      improvement: l.improvement,
    })),
    totalInsights: insights.length,
  };
}

/** Prompt 10 route manifest for discovery and tests. */
export const BHUDHI_API_ROUTES = [
  { method: "POST", path: "/api/bhudhi/investigate", purpose: "Run all investigations" },
  { method: "POST", path: "/api/bhudhi/recommend", purpose: "Generate recommendations" },
  { method: "GET", path: "/api/bhudhi/signals", purpose: "Get current signals" },
  { method: "POST", path: "/api/bhudhi/signals", purpose: "Calculate signals" },
  { method: "GET", path: "/api/bhudhi/frameworks", purpose: "List frameworks" },
  { method: "POST", path: "/api/bhudhi/frameworks", purpose: "Evaluate framework" },
  { method: "GET", path: "/api/bhudhi/domains", purpose: "List domains" },
  { method: "GET", path: "/api/bhudhi/domains/current", purpose: "Current domain" },
  { method: "GET", path: "/api/bhudhi/status", purpose: "System status" },
  { method: "GET", path: "/api/bhudhi/insights", purpose: "Insights and learnings" },
  { method: "POST", path: "/api/bhudhi/execute", purpose: "Validate and execute recommendation" },
  { method: "POST", path: "/api/bhudhi/external/connect", purpose: "Connect external system" },
  { method: "POST", path: "/api/bhudhi/external/sync", purpose: "Sync external data" },
  { method: "GET", path: "/api/bhudhi/external/connections", purpose: "List connections" },
  { method: "GET", path: "/api/bhudhi/health", purpose: "Health check" },
  { method: "POST", path: "/api/bhudhi/torgima/next-task", purpose: "Torgima next order recommendation" },
  { method: "POST", path: "/api/bhudhi/torgima/validate-goal", purpose: "Erector goal validation" },
  { method: "GET", path: "/api/bhudhi/modules", purpose: "List 8 Bhudhi 2.0 modules" },
  { method: "POST", path: "/api/bhudhi/modules/complete-cycle", purpose: "Run Bhudhi 2.0 full cycle" },
  // Phase 2 consolidation (Prompts 31-35)
  { method: "POST", path: "/api/bhudhi/kernel/cycle", purpose: "Unified cognitive kernel cycle" },
  { method: "GET", path: "/api/bhudhi/kernel/context", purpose: "Shared context snapshot" },
  { method: "GET", path: "/api/bhudhi/kernel/events", purpose: "Kernel event chain" },
  { method: "POST", path: "/api/bhudhi/memory/query", purpose: "Query unified memory graph" },
  { method: "GET", path: "/api/bhudhi/memory/stats", purpose: "Memory graph statistics" },
  { method: "POST", path: "/api/bhudhi/protocol/send", purpose: "Send BHUDHI:// protocol message" },
  { method: "GET", path: "/api/bhudhi/protocol/history", purpose: "Protocol message history" },
  { method: "POST", path: "/api/bhudhi/runtime/execute", purpose: "Unified execution runtime (all types)" },
  { method: "GET", path: "/api/bhudhi/execution/stats", purpose: "Execution runtime statistics" },
  { method: "GET", path: "/api/bhudhi/consolidation/status", purpose: "Phase 2 consolidation manifest" },
  // Prompt 37 — production infrastructure
  { method: "GET", path: "/api/bhudhi/monitoring/health", purpose: "Deep Bhudhi layer health probe" },
  { method: "GET", path: "/api/bhudhi/monitoring/metrics", purpose: "Bhudhi + platform metrics bundle" },
  // Prompt 38 — certification & BRS
  { method: "GET", path: "/api/bhudhi/certification", purpose: "Bhudhi Readiness Score (BRS) scorecard" },
  // Prompt 40 — launch architecture
  { method: "GET", path: "/api/bhudhi/launch/status", purpose: "Launch readiness manifest" },
  { method: "GET", path: "/api/bhudhi/launch/config", purpose: "Environment + pricing tiers" },
  { method: "POST", path: "/api/bhudhi/launch/onboard", purpose: "Bhudhi launch onboarding" },
  { method: "GET", path: "/api/bhudhi/launch/limits", purpose: "Tier blueprint limits for user" },
  { method: "POST", path: "/api/telemetry", purpose: "Telemetry event ingestion" },
  // Prompt 29 — Civilization Intelligence Engine (BCIE)
  { method: "GET", path: "/api/bhudhi/civilizations", purpose: "List civilizations for blueprint" },
  { method: "POST", path: "/api/bhudhi/civilization/create", purpose: "Observe / create civilization cycle" },
  { method: "POST", path: "/api/bhudhi/civilization/simulate", purpose: "Simulate civilization dynamics" },
  { method: "POST", path: "/api/bhudhi/civilization/forecast", purpose: "Long-horizon forecast (1–100 years)" },
  { method: "POST", path: "/api/bhudhi/civilization/resilience", purpose: "Resilience + stress tests" },
  { method: "POST", path: "/api/bhudhi/civilization/simulate-years", purpose: "Multi-year simulation series" },
  { method: "POST", path: "/api/bhudhi/civilization/inflection-points", purpose: "Trajectory inflection points" },
  // Prompt 30 — AGI Expansion Engine (BAEE)
  { method: "GET", path: "/api/bhudhi/expansion/status", purpose: "Expansion governance status" },
  { method: "POST", path: "/api/bhudhi/expansion/discover", purpose: "Discover capability proposals" },
  { method: "POST", path: "/api/bhudhi/expansion/evaluate", purpose: "Evaluate proposed capabilities" },
  { method: "POST", path: "/api/bhudhi/expansion/approve", purpose: "Human approve/reject capability" },
  { method: "POST", path: "/api/bhudhi/expansion/promote", purpose: "Promote approved capability" },
  { method: "POST", path: "/api/bhudhi/expansion/rollback", purpose: "Rollback active capability" },
] as const;
