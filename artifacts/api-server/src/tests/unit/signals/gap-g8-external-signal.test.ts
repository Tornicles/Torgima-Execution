/**
 * GAP PROMPT G8 — External Signal Integration tests (T1–T5).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveSourceTrust,
  confidenceFromTrust,
  PHASE2_WEBHOOK_SOURCES,
  SOURCE_TRUST_LEVELS,
} from "../../../engines/signals/ExternalSignalTrust.js";
import { normalizeExternalPayload } from "../../../engines/signals/ExternalSignalNormalizer.js";
import {
  PHASE1_ACTIVE_FRAMEWORKS,
  defaultFrameworkSignalsWhenEmpty,
} from "../../../engines/signals/FrameworkSignalPlaceholders.js";
import { EventTypes, TERMINAL_EVENT_TYPES } from "../../../types/eventContracts.js";

const mockSignalId = "550e8400-e29b-41d4-a716-446655440099";
let insertValues: Record<string, unknown> | null = null;
let writeEventCalls: Array<Record<string, unknown>> = [];

function drizzleInsertChain(returningRow: { id: string }) {
  const returning = vi.fn().mockResolvedValue([returningRow]);
  const values = vi.fn((payload: Record<string, unknown>) => {
    insertValues = payload;
    return { returning };
  });
  return { values };
}

function drizzleSelectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from };
}

vi.mock("@workspace/db", () => ({
  db: {
    insert: vi.fn(() => drizzleInsertChain({ id: mockSignalId })),
    select: vi.fn(() => drizzleSelectChain([])),
  },
  externalSignals: {
    id: "id",
    user_id: "user_id",
    blueprint_id: "blueprint_id",
    source_name: "source_name",
    trust_level: "trust_level",
  },
  frameworkSignalSnapshots: {
    blueprint_id: "blueprint_id",
    framework_name: "framework_name",
    signal_state: "signal_state",
    score: "score",
    confidence: "confidence",
  },
}));

vi.mock("../../../services/EventService.js", () => ({
  writeEvent: vi.fn(async (input: Record<string, unknown>) => {
    writeEventCalls.push(input);
  }),
  EVENT_TYPES: {
    EXTERNAL_SIGNAL_RECEIVED: "external_signal_received",
  },
}));

describe("GAP G8 — trust registry", () => {
  it("T2: unknown source → UNTRUSTED / rejection reason", async () => {
    expect(resolveSourceTrust("unknown_source")).toBe("UNTRUSTED");
    const { ExternalSignalGateway } = await import(
      "../../../engines/signals/ExternalSignalGateway.js"
    );
    const gw = new ExternalSignalGateway();
    const result = await gw.receive({
      userId: "user-1",
      sourceName: "unknown_source",
      sourceType: "webhook",
      rawPayload: { ok: true },
    });
    expect(result).toEqual({ accepted: false, reason: "Unknown or untrusted source" });
  });

  it("google_calendar maps to MEDIUM trust", () => {
    expect(resolveSourceTrust("google_calendar")).toBe("MEDIUM");
    expect(confidenceFromTrust("MEDIUM")).toBe(0.6);
  });

  it("T5: all Phase 2 webhook sources are trusted (not UNTRUSTED)", () => {
    for (const source of PHASE2_WEBHOOK_SOURCES) {
      expect(SOURCE_TRUST_LEVELS[source]).toBeDefined();
      expect(resolveSourceTrust(source)).not.toBe("UNTRUSTED");
    }
  });
});

describe("GAP G8 — ExternalSignalGateway", () => {
  beforeEach(() => {
    insertValues = null;
    writeEventCalls = [];
    vi.clearAllMocks();
  });

  it("T1: accepts google_calendar and persists MEDIUM trust signal", async () => {
    const { ExternalSignalGateway } = await import(
      "../../../engines/signals/ExternalSignalGateway.js"
    );
    const gw = new ExternalSignalGateway();
    const result = await gw.receive({
      userId: "user-1",
      blueprintId: "bp-1",
      sourceName: "google_calendar",
      sourceType: "webhook",
      rawPayload: { event: "calendar.updated" },
    });

    expect(result).toEqual({
      accepted: true,
      signal_id: mockSignalId,
      trust_level: "MEDIUM",
    });
    expect(insertValues).toMatchObject({
      user_id: "user-1",
      blueprint_id: "bp-1",
      source_name: "google_calendar",
      trust_level: "MEDIUM",
      confidence: 0.6,
      status: "PENDING",
    });
    const normalized = await normalizeExternalPayload("google_calendar", {
      event: "calendar.updated",
    });
    expect(normalized).toMatchObject({
      source: "google_calendar",
      data: { event: "calendar.updated" },
    });
  });

  it("T3: EXTERNAL_SIGNAL_RECEIVED terminal event emitted on accept", async () => {
    const { ExternalSignalGateway } = await import(
      "../../../engines/signals/ExternalSignalGateway.js"
    );
    const gw = new ExternalSignalGateway();
    await gw.receive({
      userId: "user-2",
      sourceName: "stripe_webhook",
      sourceType: "webhook",
      rawPayload: { type: "invoice.paid" },
    });

    expect(writeEventCalls.length).toBe(1);
    expect(writeEventCalls[0]).toMatchObject({
      eventType: "external_signal_received",
      entityType: "external_signal",
      entityId: mockSignalId,
      userId: "user-2",
      payload: expect.objectContaining({
        signal_id: mockSignalId,
        source_name: "stripe_webhook",
        trust_level: "HIGH",
      }),
    });
    expect(TERMINAL_EVENT_TYPES.has(EventTypes.EXTERNAL_SIGNAL_RECEIVED)).toBe(true);
  });

  it("rejects invalid payload (non-object)", async () => {
    const { ExternalSignalGateway } = await import(
      "../../../engines/signals/ExternalSignalGateway.js"
    );
    const gw = new ExternalSignalGateway();
    const result = await gw.receive({
      userId: "user-1",
      sourceName: "manual_evidence",
      sourceType: "manual",
      rawPayload: "not-an-object" as unknown as Record<string, unknown>,
    });
    expect(result).toEqual({ accepted: false, reason: "Invalid payload structure" });
  });
});

describe("GAP G8 — framework signal placeholders", () => {
  it("T4: four Phase 1 frameworks have insufficient_data defaults", () => {
    expect(PHASE1_ACTIVE_FRAMEWORKS).toHaveLength(4);
    expect(PHASE1_ACTIVE_FRAMEWORKS).toEqual([
      "strategycore",
      "customervalue",
      "synergyops",
      "governance_risk",
    ]);
    const defaults = defaultFrameworkSignalsWhenEmpty();
    expect(defaults).toHaveLength(4);
    for (const row of defaults) {
      expect(row.signal_state).toBe("insufficient_data");
      expect(row.score).toBeNull();
      expect(row.confidence).toBeNull();
    }
  });
});

describe("GAP G8 — webhook route contract", () => {
  it("T5: configured sources list includes Phase 2 endpoints", async () => {
    const mod = await import("../../../engines/signals/ExternalSignalTrust.js");
    expect(mod.PHASE2_WEBHOOK_SOURCES).toContain("stripe_webhook");
    expect(mod.PHASE2_WEBHOOK_SOURCES).toContain("google_calendar");
    expect(mod.PHASE2_WEBHOOK_SOURCES).toContain("apple_health");
  });
});
