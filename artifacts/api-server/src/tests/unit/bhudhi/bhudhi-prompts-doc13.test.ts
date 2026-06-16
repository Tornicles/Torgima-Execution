/**
 * DOC13 — Bhudhi Prompt Library verification.
 */
import { describe, it, expect } from "vitest";
import {
  OUTPUT_SCHEMAS,
  StateExplanationSchema,
  StructuredGoalSchema,
  TaskCopySchema,
} from "../../../lib/bhudhi/schemas/OutputSchemas.js";
import {
  FALLBACKS,
  FallbackLibrary,
  validateAllFallbacksAgainstSchemas,
} from "../../../lib/bhudhi/fallbacks/FallbackLibrary.js";
import { PROMPT_CONTRACTS, assertPromptRegistryMatchesRouter } from "../../../lib/bhudhi/prompts/PromptContracts.js";
import { SystemPromptBuilder, GLOBAL_RULES } from "../../../lib/bhudhi/prompts/SystemPromptBuilder.js";
import { FORBIDDEN_PATTERNS } from "../../../lib/bhudhi/OutputValidator.js";
import { REGISTERED_TRIGGERS } from "../../../lib/bhudhi/TriggerRegistry.js";

describe("bhudhi-prompts DOC13 — registry coverage", () => {
  it("has prompt contracts for every router trigger", () => {
    expect(() => assertPromptRegistryMatchesRouter()).not.toThrow();
    expect(Object.keys(PROMPT_CONTRACTS).sort()).toEqual(Object.keys(REGISTERED_TRIGGERS).sort());
  });

  it("system prompt builder injects mode-specific instructions", () => {
    const draft = SystemPromptBuilder.build("DRAFT", "TASK_DRAFTING");
    expect(draft).toContain(GLOBAL_RULES.slice(0, 40));
    expect(draft).toContain("Mode DRAFT");
    expect(draft).toContain("TASK_DRAFTING");
  });
});

describe("bhudhi-prompts DOC13 — fallback schema validation", () => {
  it("every fallback passes its own output schema", () => {
    const report = validateAllFallbacksAgainstSchemas();
    expect(report.ok, report.errors.join("; ")).toBe(true);

    for (const [trigger, fallback] of Object.entries(FALLBACKS)) {
      const schema = OUTPUT_SCHEMAS[trigger as keyof typeof OUTPUT_SCHEMAS];
      expect(() => schema.parse(fallback.data)).not.toThrow();
    }
  });

  it("task copy fallback title is under 120 chars", () => {
    const data = FALLBACKS.TASK_DRAFTING.data;
    expect(String(data.title).length).toBeLessThanOrEqual(120);
    expect(() => TaskCopySchema.parse(data)).not.toThrow();
  });

  it("state explanation fallback passes StateExplanationSchema", () => {
    expect(() => StateExplanationSchema.parse(FALLBACKS.STATE_EXPLANATION.data)).not.toThrow();
  });

  it("root cause fallback has at least one candidate", () => {
    const candidates = FALLBACKS.ROOT_CAUSE_ASSIST.data.candidates as unknown[];
    expect(candidates.length).toBeGreaterThanOrEqual(1);
  });
});

describe("bhudhi-prompts DOC13 — schema strictness", () => {
  it("rejects empty objects for required fields", () => {
    expect(() => StructuredGoalSchema.parse({})).toThrow();
    expect(() => TaskCopySchema.parse({})).toThrow();
    expect(() => StateExplanationSchema.parse({})).toThrow();
  });
});

describe("bhudhi-prompts DOC13 — envelope adapter", () => {
  it("produces legacy-compatible envelope from DOC13 fallback", () => {
    const envelope = FallbackLibrary.getEnvelope("TASK_DRAFTING", 3, {});
    expect(envelope.outputType).toBe("task_copy");
    expect(envelope.stateVersion).toBe(3);
    expect(envelope.forbiddenActionRequested).toBe(false);
    expect((envelope.data as { title: string }).title).toBeTruthy();
  });
});

describe("bhudhi-prompts DOC13 — forbidden patterns", () => {
  it("forbidden pattern list is defined for validation layer", () => {
    expect(FORBIDDEN_PATTERNS.length).toBeGreaterThan(0);
    expect(FORBIDDEN_PATTERNS.some((p) => p.toLowerCase().includes("updated"))).toBe(true);
  });
});
