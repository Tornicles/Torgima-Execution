/**
 * Compile-time guard: invalid status literals must not assign to canonical enums.
 * Run: pnpm -F @workspace/state-machine exec tsc --noEmit -p tsconfig.json
 */
import type { BlueprintStatus } from "./index.js";

// @ts-expect-error INVALID_STATUS is not a BlueprintStatus
const _invalidBlueprintStatus: BlueprintStatus = "INVALID_STATUS";

void _invalidBlueprintStatus;
