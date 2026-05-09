/**
 * Runs before Vitest suites. DATABASE_URL avoids import-time crashes from `@workspace/db`
 * during unit-only runs; Anthropic / Resend are mocked so AI and email SDKs stay offline.
 *
 * Integration tests targeting a live Postgres export `TORGIMA_INTEGRATION=true` and point
 * `DATABASE_URL` at that database — do not rely on `vitest_stub` in DATABASE_URL then.
 *
 * @vitest-environment node
 */
import { vi } from "vitest";

const integration =
  typeof process.env.TORGIMA_INTEGRATION === "string" &&
  ["1", "true", "yes"].includes(process.env.TORGIMA_INTEGRATION.toLowerCase());

if (!integration) {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@127.0.0.1:5432/torgima_vitest_stub";
}

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

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: vi.fn().mockResolvedValue({ id: "mock-email-id" }) };
  },
}));
