/**
 * Prompt 9 — Erector acceptance criteria items 21–41 (master checklist extension).
 */
export type ErectorAcResult = { item: number; label: string; pass: boolean; note?: string };

export function erectorAc(item: number, label: string, pass: boolean, note?: string): ErectorAcResult {
  return { item, label, pass, note };
}

export const ERECTOR_ACCEPTANCE_ITEMS: ReadonlyArray<{ item: number; label: string }> = [
  { item: 21, label: "30 Economic Archetypes seeded with substantive profiles" },
  { item: 22, label: "Nigeria vs Germany fixtures diverge on scores and briefings" },
  { item: 23, label: "Iran briefing contains payment system warning" },
  { item: 24, label: "High-corruption archetype briefing has relationship guidance" },
  { item: 25, label: "All 9 validation engines produce non-empty outputs" },
  { item: 26, label: "Fallback mode: engines complete with fallback_used logs" },
  { item: 27, label: "Scoring Engine deterministic without BhudhiLog" },
  { item: 28, label: "Blocked validation returns 400 on launch" },
  { item: 29, label: "Pivot blocks launch until alternative path" },
  { item: 30, label: "Adjust blocks launch until adjusted path" },
  { item: 31, label: "Proceed launches with current path" },
  { item: 32, label: "90d simulation daily_task_count > 1yr" },
  { item: 33, label: "Archetype timeframe mult affects simulation" },
  { item: 34, label: "Three paths generated every validation" },
  { item: 35, label: "First week 404 before path selection" },
  { item: 36, label: "Launched blueprint has 7 smoke test orders" },
  { item: 37, label: "Dashboard Execution Context panel fields" },
  { item: 38, label: "Smoke Test indicator on seed orders only" },
  { item: 39, label: "After smoke complete, next task not seed reason" },
  { item: 40, label: "Stuck validation creates validation_pipeline warn log" },
  { item: 41, label: "Full Erector flow under 30s API time" },
];

export function formatErectorAcceptanceReport(results: ErectorAcResult[]): string {
  const lines = ["TORGIMA — ERECTOR ACCEPTANCE CRITERIA 21–41", ""];
  const merged = ERECTOR_ACCEPTANCE_ITEMS.map((def) => {
    const r = results.find((x) => x.item === def.item);
    return r ?? erectorAc(def.item, def.label, false, "not run");
  });
  for (const r of merged) {
    const status = r.pass ? "PASS" : "FAIL";
    lines.push(`  Item ${r.item} — ${r.label}: ${status}${r.note ? ` (${r.note})` : ""}`);
  }
  const failed = merged.filter((r) => !r.pass);
  lines.push("");
  lines.push(`Total passing: ${merged.filter((r) => r.pass).length} of ${ERECTOR_ACCEPTANCE_ITEMS.length}`);
  lines.push(`PHASE 1 ERECTOR COMPLETE: ${failed.length === 0 ? "YES" : "NO"}`);
  return lines.join("\n");
}
