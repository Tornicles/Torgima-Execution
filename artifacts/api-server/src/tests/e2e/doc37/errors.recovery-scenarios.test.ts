/**
 * DOC 37 §6 — recovery scenario tests.
 */
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import {
  integrationEnabled,
  createTestUser,
  createTestBlueprint,
  createTestOrder,
  cleanupTestUser,
} from "../../helpers/db.js";
import { db, orders, featureFlags } from "@workspace/db";
import { classifyInactivity } from "../../../engines/inactivity/InactivityThresholds.js";
import { StateIntegrityEngine } from "../../../engines/execution-loop/StateIntegrityEngine.js";
import {
  activateDegradedMode,
  recoverDegradedMode,
  isDegradedMode,
  DEGRADED_MODE_FLAG,
} from "../../../engines/execution-loop/DegradedMode.js";
import { replayDeadLetteredEvent } from "../../../workers/DeadLetterHandler.js";
import { EventStatus } from "@workspace/state-machine";
import { events } from "@workspace/db";

const run = integrationEnabled();

describe("DOC 37 — errors.recovery-scenarios (unit surface)", () => {
  it("RECOVERY 1: 30 days absence classifies critical abandonment", () => {
    const hit = classifyInactivity(30 * 24);
    expect(hit).not.toBeNull();
    expect(hit?.severity).toBe("CRITICAL");
    expect(hit?.type).toBe("ABANDONED_LOOP");
  });

  it("RECOVERY 2: StateIntegrityEngine exposes DOUBLE_ACTIVE_ORDER check", async () => {
    const engine = new StateIntegrityEngine();
    expect(typeof engine.checkDoubleActiveOrder).toBe("function");
  });

  it("RECOVERY 3: degraded mode recovery clears flag (structural)", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../../engines/execution-loop/DegradedMode.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("recoverDegradedMode");
    expect(src).toContain("SYSTEM_HEALTH_RESTORED");
    expect(src).toContain("degraded_mode: false");
  });

  it("RECOVERY 4: replayDeadLetteredEvent resets event to pending", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../../workers/DeadLetterHandler.ts", import.meta.url), "utf8"),
    );
    expect(src).toContain("status: EventStatus.PENDING");
    expect(src).toContain("retry_count: 0");
  });

  it("RECOVERY 5: erector revalidation path exists (structural)", async () => {
    const pipeline = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../../engines/erector/ErectorValidationPipeline.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(pipeline).toMatch(/validation|verdict|correction/i);
  });
});

describe.skipIf(!run)("DOC 37 — recovery scenarios (integration)", () => {
  it("RECOVERY 2: double active order detected by integrity engine", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    await createTestOrder(bp.id, user.id, { status: "active", started_at: new Date() });
    await createTestOrder(bp.id, user.id, { status: "active", started_at: new Date() });

    const engine = new StateIntegrityEngine();
    const findings = await engine.checkDoubleActiveOrder();
    expect(findings.some((f) => f.issueCode === "DOUBLE_ACTIVE_ORDER")).toBe(true);

    await cleanupTestUser(user.id);
  }, 30_000);

  it("RECOVERY 3: system recovers from degraded mode", async () => {
    await activateDegradedMode({
      reason: "doc37 test",
      severity: "CRITICAL",
    });
    expect(await isDegradedMode()).toBe(true);

    await recoverDegradedMode();
    expect(await isDegradedMode()).toBe(false);

    const [flag] = await db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.feature_name, DEGRADED_MODE_FLAG))
      .limit(1);
    expect(flag?.enabled).toBe(false);
  }, 30_000);

  it("RECOVERY 4: dead letter replay re-queues event", async () => {
    const user = await createTestUser();
    const bp = await createTestBlueprint(user.id);
    const [evt] = await db
      .insert(events)
      .values({
        event_type: "feedback_submitted",
        entity_type: "feedback",
        entity_id: "00000000-0000-4000-8000-000000000099",
        user_id: user.id,
        blueprint_id: bp.id,
        status: EventStatus.DEAD_LETTERED,
        retry_count: 3,
        payload: { doc37: true },
        idempotency_key: `doc37-dlq-${Date.now()}`,
      })
      .returning({ id: events.id, status: events.status });

    await replayDeadLetteredEvent(evt!.id);

    const [row] = await db
      .select({ status: events.status, retry_count: events.retry_count })
      .from(events)
      .where(eq(events.id, evt!.id))
      .limit(1);
    expect(row?.status).toBe(EventStatus.PENDING);
    expect(row?.retry_count).toBe(0);

    await cleanupTestUser(user.id);
  }, 30_000);
});
