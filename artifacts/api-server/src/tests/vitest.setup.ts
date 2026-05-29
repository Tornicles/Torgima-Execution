/**
 * Runs before Vitest suites. DATABASE_URL avoids import-time crashes from `@workspace/db`
 * during unit-only runs; Anthropic / Resend are mocked so AI and email SDKs stay offline.
 *
 * Integration tests: set `TORGIMA_INTEGRATION=true` — loads `.env.local` / `.env` when present.
 *
 * @vitest-environment node
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function loadEnvKeys(filePath: string, keys: readonly string[]): void {
  if (!existsSync(filePath)) return;
  const want = new Set(keys);
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!want.has(key) || process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvKeys(join(repoRoot, ".env.local"), ["TORGIMA_INTEGRATION"] as const);
loadEnvKeys(join(repoRoot, ".env"), ["TORGIMA_INTEGRATION"] as const);
loadEnvKeys(join(repoRoot, "artifacts", "api-server", ".env"), ["TORGIMA_INTEGRATION"] as const);

const integrationRequested =
  typeof process.env.TORGIMA_INTEGRATION === "string" &&
  ["1", "true", "yes"].includes(process.env.TORGIMA_INTEGRATION.toLowerCase());

if (integrationRequested) {
  loadEnvKeys(join(repoRoot, ".env.local"), ["DATABASE_URL", "DIRECT_URL"] as const);
  loadEnvKeys(join(repoRoot, ".env"), ["DATABASE_URL", "DIRECT_URL"] as const);
  loadEnvKeys(join(repoRoot, "artifacts", "api-server", ".env"), ["DATABASE_URL", "DIRECT_URL"] as const);
}

const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
const integration = integrationRequested && dbUrl.startsWith("postgres");

if (integration) {
  process.env.DATABASE_URL = dbUrl;
} else {
  // Unit runs must never inherit a developer .env DATABASE_URL (avoids flaky CI/local drift).
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:5432/torgima_vitest_stub";
  delete process.env.DIRECT_URL;
}

if (!integration) {
  vi.mock("@anthropic-ai/sdk", () => ({
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                outputType: "task_copy",
                contractVersion: "1.0",
                stateVersion: 0,
                confidence: "MEDIUM",
                data: {
                  title: "Test task",
                  instruction: "Test instruction",
                  proofInstruction: "Test proof",
                  successCriteria: ["Done"],
                  estimatedEffortLabel: "MEDIUM",
                  userFacingReason: "Test reason",
                },
                missingFields: [],
                warnings: [],
                forbiddenActionRequested: false,
              }),
            },
          ],
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
      };
    },
  }));
}

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: vi.fn().mockResolvedValue({ id: "mock-email-id" }) };
  },
}));
