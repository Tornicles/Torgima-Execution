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
import { spawn } from "node:child_process";
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

async function runChild(cmd: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  console.log(dryRun ? "[dry-run] 25-sequence backfill" : "[run] 25-sequence backfill");

  if (!dryRun) {
    console.log("\n1) Applying manual migrations…");
    await runChild("node", [path.join(REPO_ROOT, "scripts/apply-pending-manual-migrations.mjs")]).catch(
      (err) => console.warn("  migrations warn:", err),
    );
    console.log("\n2) Seeding tier_sequence_gates…");
    await runChild("node", [path.join(REPO_ROOT, "scripts/seed-tier-sequence-gates.mjs")]).catch(
      (err) => console.warn("  tier gates warn:", err),
    );
  } else {
    console.log("\n(dry-run) skip migrations + tier gate seed");
  }

  const { db, pool, blueprints, users, inAppNotifications, orders, feedback } =
    await import("@workspace/db");

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
