/**
 * Erector schema aggregator — maps to packages/db/src/schema-erector.ts in Prompt 1 spec.
 * Re-exports all Erector Drizzle table definitions (Schemas 1–3 + B-addendum).
 */
export * from "./schema/erectorTables.js";
export * from "./schema/erectorCoreRuntimeTables.js";
export * from "./schema/erectorExecutionIntelligenceTables.js";
export * from "./schema/erectorGovernanceOperationsTables.js";
