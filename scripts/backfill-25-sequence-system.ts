#!/usr/bin/env node
/**
 * Backfill 25-sequence system for existing users/blueprints:
 * - Applies manual migrations (best-effort)
 * - Seeds tier_sequence_gates
 * - Initializes sequence flows + canonical checkpoints for launched blueprints
 * - Seeds Growth/Ultimate knowledge cards
 * - Posts in-app upgrade notice per user
 *
 * Usage: pnpm backfill:25-sequences
 *        pnpm backfill:25-sequences --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { and, eq, inArray, sql } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const API_SRC = path.join(REPO_ROOT, "artifacts/api-server/src");

dotenv.config({ path: path.join(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.join(REPO_ROOT, ".env") });
dotenv.config({ path: path.join(REPO_ROOT, "artifacts/api-server/.env") });

process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const dryRun = process.argv.includes("--dry-run");
const NOTICE_TYPE = "system_upgrade_25_sequences";

function tierFromBlueprint(row: {
  tier: string | null;
  blueprint_tier: string | null;
  selected_blueprint_level: string | null;
}): string {
  return (
    row.selected_blueprint_level ??
    row.blueprint_tier ??
    row.tier ??
    "starter"
  ).toLowerCase();
}

function isLaunched(row: { status: string; active: boolean }): boolean {
  return row.active === true || row.status === "active";
}

function sequencesToBackfill(
  row: {
    status: string;
    active: boolean;
    sequences_completed_numbers: number[];
    current_sequence_number: number;
  },
  orderCount: number,
  feedbackCount: number,
): number[] {
  const done = new Set(row.sequences_completed_numbers ?? []);
  const maxExisting = done.size > 0 ? Math.max(...done) : 0;

  let target = Math.max(row.current_sequence_number ?? 1, maxExisting);
  if (isLaunched(row)) {
    target = Math.max(target, 16);
    if (orderCount > 0) target = Math.max(target, 17);
    if (feedbackCount > 0) target = Math.max(target, 19);
    if (orderCount >= 5) target = Math.max(target, 22);
    if (orderCount >= 10) target = Math.max(target, 23);
  } else if (row.status !== "draft") {
    target = Math.max(target, 5);
  }

  target = Math.min(23, target);
  const launchStack = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16];
  const out = new Set<number>();
  for (const n of launchStack) {
    if (n <= target) out.add(n);
  }
  for (let n = 12; n <= target; n++) out.add(n);
  return [...out].sort((a, b) => a - b);
}

const SEQUENCE_MIGRATIONS = [
  "manual-20260530-sequence-tracking-foundation.sql",
  "manual-20260531-growth-features.sql",
  "manual-20260601-ultimate-features.sql",
];

const TIER_GATES = [
  {
    blueprint_tier: "Growth",
    sequence_number: 24,
    unlocks_after_seq: 23,
    requires_tier: "Growth",
    unlocks_feature: "Interrogation",
    feature_description: "Ask clarifying questions based on feedback",
    is_growth_only: true,
    is_ultimate_only: false,
  },
  {
    blueprint_tier: "Growth",
    sequence_number: 24,
    unlocks_after_seq: 23,
    requires_tier: "Growth",
    unlocks_feature: "Knowledge Cards",
    feature_description: "Structured guidance and learning resources",
    is_growth_only: true,
    is_ultimate_only: false,
  },
  {
    blueprint_tier: "Ultimate",
    sequence_number: 25,
    unlocks_after_seq: 24,
    requires_tier: "Ultimate",
    unlocks_feature: "Predictions",
    feature_description: "Forecast next tasks and blockers",
    is_growth_only: false,
    is_ultimate_only: true,
  },
  {
    blueprint_tier: "Ultimate",
    sequence_number: 25,
    unlocks_after_seq: 24,
    requires_tier: "Ultimate",
    unlocks_feature: "Scene Engine",
    feature_description: "Current vs expected vs ideal state tracking",
    is_growth_only: false,
    is_ultimate_only: true,
  },
];

async function applySequenceMigrations(pool: { query: (sql: string) => Promise<unknown> }) {
  const dir = path.join(REPO_ROOT, "scripts/migrations");
  for (const file of SEQUENCE_MIGRATIONS) {
    const full = path.join(dir, file);
    const sql = fs.readFileSync(full, "utf8");
    try {
      await pool.query(sql);
      console.log(`  migrations OK: ${file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  migrations WARN ${file}: ${msg}`);
    }
  }
}

async function seedTierGates(pool: {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}) {
  for (const gate of TIER_GATES) {
    await pool.query(
      `INSERT INTO tier_sequence_gates (
        blueprint_tier, sequence_number, unlocks_after_seq, requires_tier,
        unlocks_feature, feature_description, is_growth_only, is_ultimate_only
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (blueprint_tier, sequence_number, unlocks_feature) DO UPDATE SET
        unlocks_after_seq = EXCLUDED.unlocks_after_seq,
        requires_tier = EXCLUDED.requires_tier,
        feature_description = EXCLUDED.feature_description,
        is_growth_only = EXCLUDED.is_growth_only,
        is_ultimate_only = EXCLUDED.is_ultimate_only`,
      [
        gate.blueprint_tier,
        gate.sequence_number,
        gate.unlocks_after_seq,
        gate.requires_tier,
        gate.unlocks_feature,
        gate.feature_description,
        gate.is_growth_only,
        gate.is_ultimate_only,
      ],
    );
  }
  console.log(`  tier gates seeded: ${TIER_GATES.length}`);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  console.log(dryRun ? "[dry-run] 25-sequence backfill" : "[run] 25-sequence backfill");

  const { db, pool, blueprints, users, inAppNotifications, orders, feedback } =
    await import("@workspace/db");

  if (!dryRun) {
    console.log("\n1) Applying sequence migrations…");
    await applySequenceMigrations(pool);
    console.log("\n2) Seeding tier_sequence_gates…");
    await seedTierGates(pool).catch((err) => console.warn("  tier gates warn:", err));
  } else {
    console.log("\n(dry-run) skip migrations + tier gate seed");
  }

  const { SequenceTrackingService } = await import(
    pathToFileURL(path.join(API_SRC, "services/SequenceTrackingService.ts")).href
  );
  const { SequenceTracker } = await import(
    pathToFileURL(path.join(API_SRC, "engines/sequence/SequenceTracker.ts")).href
  );
  const { KnowledgeService } = await import(
    pathToFileURL(path.join(API_SRC, "engines/growth/KnowledgeService.ts")).href
  );

  const allBlueprints = await db
    .select({
      id: blueprints.id,
      user_id: blueprints.user_id,
      status: blueprints.status,
      active: blueprints.active,
      tier: blueprints.tier,
      blueprint_tier: blueprints.blueprint_tier,
      selected_blueprint_level: blueprints.selected_blueprint_level,
      goal_final: blueprints.goal_final,
      purpose_final: blueprints.purpose_final,
      goal: blueprints.goal,
      purpose: blueprints.purpose,
      selected_path: blueprints.selected_path,
      sequences_completed_numbers: blueprints.sequences_completed_numbers,
      current_sequence_number: blueprints.current_sequence_number,
    })
    .from(blueprints);

  console.log(`\n3) Processing ${allBlueprints.length} blueprint(s)…`);

  let initCount = 0;
  let launchCount = 0;
  let checkpointCount = 0;
  let knowledgeCount = 0;

  for (const bp of allBlueprints) {
    const tier = tierFromBlueprint(bp);
    if (!dryRun) {
      await SequenceTrackingService.ensureInitialized(bp.id, tier);
      initCount++;
    }

    if (!isLaunched(bp)) continue;

    const [orderRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.blueprint_id, bp.id));
    const [fbRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedback)
      .where(eq(feedback.blueprint_id, bp.id));
    const orderCount = Number(orderRow?.count ?? 0);
    const feedbackCount = Number(fbRow?.count ?? 0);

    if (!dryRun) {
      await SequenceTrackingService.recordBlueprintTier(bp.id, tier).catch(() => null);
      await SequenceTrackingService.recordLaunchStack(bp.id, tier, {
        goal: bp.goal_final ?? bp.goal ?? undefined,
        purpose: bp.purpose_final ?? bp.purpose ?? undefined,
        selectedPath: bp.selected_path ?? "current",
      }).catch(() => null);
      launchCount++;
    }

    const seqNums = sequencesToBackfill(bp, orderCount, feedbackCount);
    const completed = new Set(bp.sequences_completed_numbers ?? []);

    for (const seqNum of seqNums) {
      if (completed.has(seqNum)) continue;
      if (dryRun) {
        console.log(`  [dry] checkpoint bp=${bp.id.slice(0, 8)} seq=${seqNum}`);
        continue;
      }
      await SequenceTracker.recordCheckpoint(bp.id, seqNum, {
        userAction: "Backfill: existing account upgrade",
        validationPassed: true,
        stateSnapshot: { backfill: true, orderCount, feedbackCount },
      }).catch(() => null);
      checkpointCount++;
    }

    if ((tier === "growth" || tier === "ultimate") && !dryRun) {
      await KnowledgeService.seedKnowledgeCards(bp.id, tier).catch(() => null);
      knowledgeCount++;
    }
  }

  const userIds = [...new Set(allBlueprints.map((b) => b.user_id))];
  const existingNotices = userIds.length
    ? await db
        .select({ user_id: inAppNotifications.user_id })
        .from(inAppNotifications)
        .where(
          and(
            inArray(inAppNotifications.user_id, userIds),
            eq(inAppNotifications.notification_type, NOTICE_TYPE),
          ),
        )
    : [];
  const noticed = new Set(existingNotices.map((n) => n.user_id));

  console.log(`\n4) Notifying ${userIds.length} user(s)…`);
  let noticeCount = 0;
  for (const userId of userIds) {
    if (noticed.has(userId)) continue;
    if (dryRun) {
      console.log(`  [dry] notice user=${userId.slice(0, 8)}`);
      continue;
    }
    await db.insert(inAppNotifications).values({
      user_id: userId,
      title: "Execution system upgraded",
      body: "Your account now includes the full 25-sequence execution track, tier-based Growth and Ultimate intelligence, and an updated dashboard progress panel. Open Dashboard to see your sequence position and unlocked features.",
      notification_type: NOTICE_TYPE,
      priority: 1,
    });
    noticeCount++;
  }

  const allUsers = await db.select({ id: users.id }).from(users);
  for (const u of allUsers) {
    if (userIds.includes(u.id) || noticed.has(u.id)) continue;
    if (dryRun) continue;
    const [exists] = await db
      .select({ id: inAppNotifications.id })
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.user_id, u.id),
          eq(inAppNotifications.notification_type, NOTICE_TYPE),
        ),
      )
      .limit(1);
    if (exists) continue;
    await db.insert(inAppNotifications).values({
      user_id: u.id,
      title: "Welcome to the upgraded Torgima execution system",
      body: "We upgraded sequence tracking and tier intelligence across the platform. When you create or activate a blueprint, your progress will appear on the dashboard (Sequences 1–25).",
      notification_type: NOTICE_TYPE,
      priority: 2,
    });
    noticeCount++;
  }

  console.log("\n--- Summary ---");
  console.log(`Blueprints initialized: ${initCount}`);
  console.log(`Launched stacks repaired: ${launchCount}`);
  console.log(`Checkpoints recorded: ${checkpointCount}`);
  console.log(`Knowledge seeds (growth/ultimate): ${knowledgeCount}`);
  console.log(`In-app notices created: ${noticeCount}`);
  console.log(dryRun ? "\n(dry-run complete — no writes)" : "\nBackfill complete.");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
