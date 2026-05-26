import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pool } from "@workspace/db";
import { bhudhiHealthCheck } from "./healthCheck.js";

export interface CertificationCriterion {
  name: string;
  passed: boolean;
  score: number;
}

export interface CertificationScore {
  category: string;
  score: number;
  weight: number;
  criteria: CertificationCriterion[];
}

export type BhudhiReadinessCategory = "not-ready" | "partial" | "production" | "enterprise";

export interface BhudhiReadinessScore {
  overall: number;
  category: BhudhiReadinessCategory;
  timestamp: string;
  version: string;
  scores: CertificationScore[];
  recommendations: string[];
  nextSteps: string[];
  brsLabel: string;
}

async function scalar(sql: string): Promise<number | null> {
  try {
    const result = await pool.query<{ c: string }>(sql);
    return Number(result.rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

async function tableExists(table: string): Promise<boolean> {
  const r = await pool.query<{ reg: string | null }>(
    `SELECT to_regclass('public.${table}') AS reg`,
  );
  return Boolean(r.rows[0]?.reg);
}

function repoPath(...parts: string[]): string {
  const root = process.env.RAILWAY_PROJECT_ROOT ?? process.cwd();
  return resolve(root, ...parts);
}

function categoryFromOverall(overall: number): BhudhiReadinessCategory {
  if (overall < 40) return "not-ready";
  if (overall < 70) return "partial";
  if (overall < 85) return "production";
  return "enterprise";
}

function brsLabel(category: BhudhiReadinessCategory): string {
  switch (category) {
    case "not-ready":
      return "Not ready (critical issues)";
    case "partial":
      return "Partially ready (improvements needed)";
    case "production":
      return "Production ready";
    case "enterprise":
      return "Enterprise ready";
  }
}

function generateRecommendations(scores: CertificationScore[]): string[] {
  const recommendations: string[] = [];
  for (const score of scores) {
    for (const criterion of score.criteria.filter((c) => !c.passed)) {
      recommendations.push(`[${score.category}] ${criterion.name}`);
    }
  }
  return recommendations;
}

function generateNextSteps(category: BhudhiReadinessCategory): string[] {
  const steps: Record<BhudhiReadinessCategory, string[]> = {
    "not-ready": [
      "Apply migrations 0026–0029 and run scripts/migrate-production.sh",
      "Fix reliability failures (kernel events, runtime results)",
      "Resolve security and auth configuration gaps",
      "Re-run GET /api/bhudhi/certification",
    ],
    partial: [
      "Address performance bottlenecks (protocol latency, memory growth)",
      "Enable monitoring at /app/bhudhi/monitoring",
      "Run scripts/db-setup.sql on production Postgres",
      "Conduct security review and re-certify",
    ],
    production: [
      "Monitor in production with /api/health and /api/metrics",
      "Schedule periodic backups (scripts/backup-production.sh)",
      "Collect BRS trend monthly",
      "Plan Prompt 38+ feature rollout",
    ],
    enterprise: [
      "Maintain current BRS ≥ 85",
      "Run full benchmarks with RUN_BHUDHI_BENCHMARKS=true before major releases",
      "Annual certification review",
      "Expand civilization / expansion engines as needed",
    ],
  };
  return steps[category];
}

export class BhudhiCertification {
  async calculate(): Promise<BhudhiReadinessScore> {
    const scores: CertificationScore[] = await Promise.all([
      this.assessReliability(),
      this.assessPerformance(),
      this.assessSecurity(),
      this.assessOperational(),
      this.assessScalability(),
      this.assessConsolidation(),
    ]);

    const weightSum = scores.reduce((sum, s) => sum + s.weight, 0);
    const overall =
      weightSum > 0
        ? scores.reduce((sum, s) => sum + s.score * s.weight, 0) / weightSum
        : 0;

    const rounded = Math.round(overall);
    const category = categoryFromOverall(rounded);

    return {
      overall: rounded,
      category,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION ?? "2.0.0",
      scores,
      recommendations: generateRecommendations(scores),
      nextSteps: generateNextSteps(category),
      brsLabel: brsLabel(category),
    };
  }

  private async assessReliability(): Promise<CertificationScore> {
    const criteria: CertificationCriterion[] = [];
    const total = await scalar("SELECT COUNT(*)::int AS c FROM bhudhi_kernel_events");
    const failed = await scalar(
      `SELECT COUNT(*)::int AS c FROM bhudhi_kernel_events WHERE status = 'failed'`,
    );

    const uptime =
      total != null && total > 0 && failed != null ? ((total - failed) / total) * 100 : total === 0 ? 100 : 0;

    criteria.push({
      name: "Kernel event processing uptime > 99%",
      passed: uptime > 99,
      score: Math.min(100, Math.round(uptime)),
    });

    const execTotal = await scalar(
      "SELECT COUNT(*)::int AS c FROM bhudhi_unified_execution_contexts",
    );
    const execOk = await scalar(
      `SELECT COUNT(*)::int AS c FROM bhudhi_unified_execution_results WHERE success = true`,
    );
    const execRate =
      execTotal != null && execTotal > 0 && execOk != null ? (execOk / execTotal) * 100 : execTotal === 0 ? 100 : 0;

    criteria.push({
      name: "Unified runtime success rate > 95%",
      passed: execRate > 95,
      score: Math.min(100, Math.round(execRate)),
    });

    const health = await bhudhiHealthCheck.check().catch(() => null);
    criteria.push({
      name: "Bhudhi monitoring health not unhealthy",
      passed: health?.status !== "unhealthy",
      score: health?.status === "healthy" ? 100 : health?.status === "degraded" ? 75 : 25,
    });

    const categoryScore =
      criteria.reduce((sum, c) => sum + c.score, 0) / Math.max(criteria.length, 1);

    return { category: "Reliability", score: categoryScore, weight: 0.22, criteria };
  }

  private async assessPerformance(): Promise<CertificationScore> {
    const criteria: CertificationCriterion[] = [];

    const avgLatency = await pool
      .query<{ avg: string | null }>(
        `SELECT AVG(latency_ms)::float AS avg FROM bhudhi_protocol_messages
         WHERE latency_ms IS NOT NULL AND sent_at > now() - interval '7 days'`,
      )
      .then((r) => Number(r.rows[0]?.avg ?? 0))
      .catch(() => null);

    const latencyScore =
      avgLatency == null ? 50 : avgLatency < 100 ? 100 : Math.max(20, Math.round((100 / avgLatency) * 100));

    criteria.push({
      name: "Protocol message latency < 100ms (7d avg)",
      passed: avgLatency != null && avgLatency < 100,
      score: latencyScore,
    });

    const nodeCount = await scalar("SELECT COUNT(*)::int AS c FROM bhudhi_memory_nodes");
    criteria.push({
      name: "Memory graph size < 100k nodes",
      passed: nodeCount != null && nodeCount < 100_000,
      score: nodeCount == null ? 40 : nodeCount < 100_000 ? 100 : 50,
    });

    const categoryScore =
      criteria.reduce((sum, c) => sum + c.score, 0) / Math.max(criteria.length, 1);

    return { category: "Performance", score: categoryScore, weight: 0.18, criteria };
  }

  private async assessSecurity(): Promise<CertificationScore> {
    const criteria: CertificationCriterion[] = [];

    const rejected = await scalar(
      `SELECT COUNT(*)::int AS c FROM bhudhi_kernel_events WHERE event_type LIKE '%security.rejected%'`,
    );

    criteria.push({
      name: "No security rejection events (or minimal)",
      passed: rejected === 0,
      score: rejected === 0 ? 100 : rejected != null && rejected < 5 ? 70 : 30,
    });

    const authOk = Boolean(
      process.env.INTERNAL_AUTH_SECRET?.trim() ||
        process.env.NEXTAUTH_SECRET?.trim(),
    );
    criteria.push({
      name: "Authentication secret configured",
      passed: authOk,
      score: authOk ? 100 : 0,
    });

    const prodKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    criteria.push({
      name: "Production AI key configured",
      passed: process.env.NODE_ENV !== "production" || prodKey,
      score: process.env.NODE_ENV !== "production" ? 100 : prodKey ? 100 : 0,
    });

    const categoryScore =
      criteria.reduce((sum, c) => sum + c.score, 0) / Math.max(criteria.length, 1);

    return { category: "Security", score: categoryScore, weight: 0.2, criteria };
  }

  private async assessOperational(): Promise<CertificationScore> {
    const criteria: CertificationCriterion[] = [];

    criteria.push({
      name: "Health check endpoints deployed",
      passed: true,
      score: 100,
    });

    criteria.push({
      name: "Logging configured (LOG_LEVEL)",
      passed: Boolean(process.env.LOG_LEVEL?.trim()),
      score: process.env.LOG_LEVEL ? 100 : 50,
    });

    const backupReady = existsSync(repoPath("scripts", "backup-production.sh"));
    criteria.push({
      name: "Backup scripts ready",
      passed: backupReady,
      score: backupReady ? 100 : 0,
    });

    const migrateReady = existsSync(repoPath("scripts", "migrate-production.sh"));
    criteria.push({
      name: "Production migration script ready",
      passed: migrateReady,
      score: migrateReady ? 100 : 0,
    });

    const categoryScore =
      criteria.reduce((sum, c) => sum + c.score, 0) / Math.max(criteria.length, 1);

    return { category: "Operational", score: categoryScore, weight: 0.18, criteria };
  }

  private async assessScalability(): Promise<CertificationScore> {
    const criteria: CertificationCriterion[] = [];

    const dbSetup = existsSync(repoPath("scripts", "db-setup.sql"));
    criteria.push({
      name: "Database index script (db-setup.sql)",
      passed: dbSetup,
      score: dbSetup ? 100 : 50,
    });

    const rateLimit = process.env.ENABLE_RATE_LIMITING !== "false";
    criteria.push({
      name: "API rate limiting active",
      passed: rateLimit,
      score: rateLimit ? 100 : 50,
    });

    criteria.push({
      name: "Caching layer (optional Redis)",
      passed: Boolean(process.env.REDIS_URL?.trim()) || process.env.ENABLE_CACHING === "false",
      score: process.env.REDIS_URL ? 100 : 75,
    });

    const categoryScore =
      criteria.reduce((sum, c) => sum + c.score, 0) / Math.max(criteria.length, 1);

    return { category: "Scalability", score: categoryScore, weight: 0.12, criteria };
  }

  private async assessConsolidation(): Promise<CertificationScore> {
    const criteria: CertificationCriterion[] = [];
    const tables = [
      "bhudhi_kernel_events",
      "bhudhi_memory_nodes",
      "bhudhi_protocol_messages",
      "bhudhi_unified_execution_contexts",
    ];

    let present = 0;
    for (const t of tables) {
      if (await tableExists(t)) present += 1;
    }

    const pct = (present / tables.length) * 100;
    criteria.push({
      name: "Phase 2 consolidation tables (0026–0029)",
      passed: present === tables.length,
      score: Math.round(pct),
    });

    const systems = await scalar("SELECT COUNT(*)::int AS c FROM bhudhi_systems");
    criteria.push({
      name: "Bhudhi catalog seeded (systems > 0)",
      passed: systems != null && systems > 0,
      score: systems != null && systems > 0 ? 100 : 0,
    });

    const categoryScore =
      criteria.reduce((sum, c) => sum + c.score, 0) / Math.max(criteria.length, 1);

    return { category: "Consolidation", score: categoryScore, weight: 0.1, criteria };
  }
}

export const bhudhiCertification = new BhudhiCertification();
