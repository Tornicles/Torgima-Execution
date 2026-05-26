#!/usr/bin/env node
/**
 * Seed tier_sequence_gates (Growth seq 24, Ultimate seq 25).
 * Usage: node scripts/seed-tier-sequence-gates.mjs
 */
import pg from "pg";

const gates = [
  {
    blueprint_tier: "Growth",
    sequence_number: 24,
    unlocks_after_seq: 23,
    requires_tier: "Growth",
    unlocks_feature: "Interrogation",
    feature_description: "Ask clarifying questions based on feedback",
    is_growth_only: true,
    is_ultimate_only: false,
  },
  {
    blueprint_tier: "Growth",
    sequence_number: 24,
    unlocks_after_seq: 23,
    requires_tier: "Growth",
    unlocks_feature: "Knowledge Cards",
    feature_description: "Structured guidance and learning resources",
    is_growth_only: true,
    is_ultimate_only: false,
  },
  {
    blueprint_tier: "Ultimate",
    sequence_number: 25,
    unlocks_after_seq: 24,
    requires_tier: "Ultimate",
    unlocks_feature: "Predictions",
    feature_description: "Forecast next tasks and blockers",
    is_growth_only: false,
    is_ultimate_only: true,
  },
  {
    blueprint_tier: "Ultimate",
    sequence_number: 25,
    unlocks_after_seq: 24,
    requires_tier: "Ultimate",
    unlocks_feature: "Scene Engine",
    feature_description: "Current vs expected vs ideal state tracking",
    is_growth_only: false,
    is_ultimate_only: true,
  },
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  for (const gate of gates) {
    await client.query(
      `INSERT INTO tier_sequence_gates (
        blueprint_tier, sequence_number, unlocks_after_seq, requires_tier,
        unlocks_feature, feature_description, is_growth_only, is_ultimate_only
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (blueprint_tier, sequence_number, unlocks_feature) DO UPDATE SET
        unlocks_after_seq = EXCLUDED.unlocks_after_seq,
        requires_tier = EXCLUDED.requires_tier,
        feature_description = EXCLUDED.feature_description,
        is_growth_only = EXCLUDED.is_growth_only,
        is_ultimate_only = EXCLUDED.is_ultimate_only`,
      [
        gate.blueprint_tier,
        gate.sequence_number,
        gate.unlocks_after_seq,
        gate.requires_tier,
        gate.unlocks_feature,
        gate.feature_description,
        gate.is_growth_only,
        gate.is_ultimate_only,
      ],
    );
  }
  console.log("Tier sequence gates seeded:", gates.length);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
