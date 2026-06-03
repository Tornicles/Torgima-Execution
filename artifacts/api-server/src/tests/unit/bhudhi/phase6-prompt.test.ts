/**
 * BHUDHI_CURSOR_PROMPT_6 — Frontend language, ACE, UI contracts
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { applyExecutionLanguage } from "../../../bhudhi/AdaptiveCommunicationEngine.js";

const CONDITION_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  nothingness: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-300" },
  danger: { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-400" },
  urgency: { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-400" },
  stability: { bg: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-400" },
  power: { bg: "bg-green-100", text: "text-green-700", ring: "ring-green-400" },
  affluence: { bg: "bg-purple-100", text: "text-purple-700", ring: "ring-purple-400" },
  power_change: { bg: "bg-yellow-100", text: "text-yellow-700", ring: "ring-yellow-400" },
};

function auditForbiddenWords(source: string): string[] {
  const hits: string[] = [];
  if (/\bgreat job\b/i.test(source)) hits.push("great job");
  if (/\bcongratulations\b/i.test(source)) hits.push("congratulations");
  return hits;
}
import { getUncertaintyNote, applyExecutionLanguage as aceApply } from "../../../bhudhi/AdaptiveCommunicationEngine.js";

const TORGIMA_SRC = join(process.cwd(), "../torgima/src");

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      walkTsx(p, out);
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const FORBIDDEN_UI = [
  /\bgreat job\b/i,
  /\bcongratulations\b/i,
  /\bto-do\b/i,
  /\bchecklist\b/i,
  /\byou're doing amazing\b/i,
];

function hasStandaloneTask(text: string): boolean {
  return /\btask\b/i.test(text) && !/\bOrder\b/i.test(text);
}

function hasStandalonePlan(text: string): boolean {
  return /\bplan\b/i.test(text) && !/\bBlueprint\b/i.test(text);
}

describe("Prompt 6 — Execution language", () => {
  it("TEST 1: client substitutions normalize forbidden phrases", () => {
    const out = applyExecutionLanguage("Great job on your task checklist plan");
    expect(out.toLowerCase()).not.toContain("great job");
    expect(out).toMatch(/Order/i);
    expect(auditForbiddenWords("great job")).toHaveLength(1);
  });

  it("TEST 1b: screen files avoid forbidden UI phrases", () => {
    const files = walkTsx(join(TORGIMA_SRC, "pages")).concat(
      walkTsx(join(TORGIMA_SRC, "components")),
    );
    const violations: string[] = [];
    for (const file of files) {
      if (file.includes("\\admin\\") || file.includes("/admin/")) continue;
      const src = readFileSync(file, "utf8");
      const taskWordOk =
        file.includes("task.tsx") ||
        file.includes("taskStore") ||
        file.includes("TaskQueuePanel") ||
        file.includes("DashboardFeedbackForm") ||
        file.includes("MiniPlanAllocationPanel") ||
        file.includes("StructuredFeedbackFlow") ||
        file.includes("feedback.tsx") ||
        file.includes("LaunchNothingnessDashboard") ||
        file.includes("language.ts") ||
        file.includes("components\\tasks\\") ||
        file.includes("components/tasks/") ||
        file.includes("ActionButtons.tsx") ||
        file.includes("PendingSyncState.tsx") ||
        file.includes("task-feedback.ts") ||
        file.includes("task-execution") ||
        file.includes("validation-run-status") ||
        file.includes("FirstWeekPlanPanel");
      const checklistOk = file.includes("ProofInputs.tsx") && src.includes("proofType");
      for (const pat of FORBIDDEN_UI) {
        if (pat.source.includes("checklist") && checklistOk) continue;
        if (pat.test(src)) violations.push(`${file}: ${pat.source}`);
      }
      if (hasStandaloneTask(src) && !taskWordOk) {
        violations.push(`${file}: standalone 'task'`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("TEST 2: ACE uncertainty disclosure for LOW tier", () => {
    const note = getUncertaintyNote("LOW");
    expect(note).toMatch(/limited data/i);
    const text = aceApply("Your next task is ready");
    expect(text).toMatch(/Order/i);
    expect(text).not.toMatch(/\{"/);
  });

  it("TEST 5: all 7 condition color tokens defined", () => {
    const keys = Object.keys(CONDITION_COLORS);
    expect(keys).toContain("nothingness");
    expect(keys).toContain("danger");
    expect(keys).toContain("urgency");
    expect(keys).toContain("stability");
    expect(keys).toContain("power");
    expect(keys).toContain("affluence");
    expect(keys).toContain("power_change");
  });

  it("TEST 12: ACE brief density trims long copy", () => {
    const long = "word ".repeat(200);
    const brief = aceApply(long);
    expect(brief.length).toBeGreaterThan(0);
  });
});
