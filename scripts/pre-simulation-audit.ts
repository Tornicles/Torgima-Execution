#!/usr/bin/env node
/**
 * Static pre-simulation audit (no DB required).
 * Run: pnpm -F @workspace/scripts audit:presim
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = join(root, "artifacts/api-server/src");

const REQUIRED_WORKERS = [
  "FeedbackWorker.ts",
  "SignalWorker.ts",
  "ConditionWorker.ts",
  "ControlWorker.ts",
  "TaskGenerationWorker.ts",
  "TaskGuaranteeWorker.ts",
  "BlueprintPositionWorker.ts",
  "InactivityWorker.ts",
  "BhudhiWorker.ts",
  "ValidationQueueWorker.ts",
  "ErectorEventWorkers.ts",
];

const REQUIRED_ROUTES = [
  'router.post("/onboarding/goal"',
  'router.post("/v1/validation/run"',
  'router.get("/v1/validations/:id/status"',
  'router.get("/v1/validations/:id/results"',
  'router.get("/v1/validations/:id/report"',
  'router.get("/state/dashboard"',
  'router.get("/orders/current"',
  'router.post("/orders/:id/feedback"',
];

function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "✅" : "❌"} ${name} — ${detail}`);
  return ok;
}

let allOk = true;

for (const w of REQUIRED_WORKERS) {
  const p = join(api, "workers", w);
  if (!check(`Worker ${w}`, existsSync(p), existsSync(p) ? "present" : "MISSING")) allOk = false;
}

const startTs = readFileSync(join(api, "workers/start.ts"), "utf8");
if (!check("EventDispatcher interval", startTs.includes("dispatchPendingEvents"), "start.ts polls events")) {
  allOk = false;
}

const routeFiles = ["routes/validation.ts", "routes/orders.ts", "routes/state.ts", "routes/onboarding.ts"]
  .map((f) => readFileSync(join(api, f), "utf8"))
  .join("\n");

for (const snippet of REQUIRED_ROUTES) {
  if (!check(`Route ${snippet}`, routeFiles.includes(snippet), "route files")) allOk = false;
}

const simHarness = existsSync(join(api, "simulation/fourteenDaySimulation.ts"));
if (!check("14-day simulation harness", simHarness, simHarness ? "present" : "MISSING")) allOk = false;

console.log(allOk ? "\nPre-simulation static audit: PASS" : "\nPre-simulation static audit: FAIL");
process.exit(allOk ? 0 : 1);
