-- ERECTOR PROMPT 1 — align critical v0.1 verdict rules + expand capability graph to 20 nodes
-- Does not modify prior migration files; idempotent upserts only.

-- Critical verdict rules (Prompt 1 TASK 4 minimum set)
INSERT INTO erector_verdict_rules (
  rule_id, rule_name, applies_to_engine, dimension, condition_description,
  threshold_type, threshold_value, severity, verdict_effect, user_visible_reason, active
) VALUES
  ('VR-001', 'Overall score proceed', 'validation', 'global',
   'overall_validation_score >= proceed_threshold for tier', 'score_gte', '{"tier_proceed":true}',
   'INFO', 'NONE', 'Your validation score meets the proceed threshold for your plan.', true),
  ('VR-002', 'Overall score pivot', 'validation', 'global',
   'overall_validation_score < pivot_threshold for tier', 'score_lte', '{"tier_pivot":true}',
   'HARD_BLOCKER', 'PIVOT', 'Your validation score is below the pivot threshold — a direction change is required.', true),
  ('VR-003', 'Overall score adjust', 'validation', 'global',
   'overall_validation_score between adjust and proceed thresholds', 'combo', '{"tier_adjust":true}',
   'SOFT_BLOCKER', 'ADJUST', 'Your plan needs adjustments before you can proceed with confidence.', true),
  ('VR-010', 'Demand below archetype minimum', 'validation', 'demand',
   'demand_proof_class < archetype_minimum from rule pack', 'class_gte', '{"archetype_min":true}',
   'HARD_BLOCKER', 'ADJUST', 'Customer validation is below what your business model requires.', true),
  ('VR-011', 'No demand evidence', 'validation', 'demand',
   'demand_proof_class = 0 (no evidence at all)', 'class_gte', '{"min":1}',
   'HARD_BLOCKER', 'PIVOT', 'No demand proof was detected — validate willingness to pay first.', true),
  ('VR-020', 'Feasibility blocked', 'validation', 'feasibility',
   'feasibility_rating = blocked', 'flag_present', '{"flag":"blocked"}',
   'HARD_BLOCKER', 'PIVOT', 'This plan is blocked by feasibility constraints.', true),
  ('VR-021', 'Feasibility unlikely', 'validation', 'feasibility',
   'feasibility_rating = unlikely', 'flag_present', '{"flag":"unlikely"}',
   'SOFT_BLOCKER', 'ADJUST', 'Feasibility is unlikely with current resources — adjust the plan.', true),
  ('VR-030', 'Market viability critical', 'validation', 'market',
   'market_viability_score < 20', 'score_lte', '{"max":19}',
   'HARD_BLOCKER', 'PIVOT', 'Market viability is too weak for this idea as stated.', true),
  ('VR-031', 'Market viability weak', 'validation', 'market',
   'market_viability_score between 21 and 40', 'combo', '{"min":21,"max":40}',
   'SOFT_BLOCKER', 'ADJUST', 'Market viability is weak — strengthen positioning or target segment.', true),
  ('VR-040', 'Contradiction critical', 'validation', 'context',
   'contradiction_score > 70 (goal contradicts context)', 'score_gte', '{"min":71}',
   'HARD_BLOCKER', 'PIVOT', 'Your goal and context contradict each other — reconcile before proceeding.', true),
  ('VR-041', 'Resource goal mismatch', 'validation', 'context',
   'resource_goal_mismatch with no correction path', 'flag_present', '{"flag":"uncorrectable"}',
   'HARD_BLOCKER', 'PIVOT', 'Your resources do not match your goal and no viable correction path exists.', true),
  ('VR-050', 'Required fields missing', 'validation', 'global',
   'required_fields missing (goal, purpose, timeframe, commitment)', 'flag_present', '{"flag":"missing_required_fields"}',
   'HARD_BLOCKER', 'ADJUST', 'Required intake fields are missing — complete them before validation.', true),
  ('VR-060', 'Framework hard veto', 'simulation', 'global',
   'framework_hard_veto = true (any framework)', 'flag_present', '{"flag":"framework_hard_veto"}',
   'HARD_BLOCKER', 'PIVOT', 'A framework veto blocks launch — resolve before continuing.', true),
  ('VR-070', 'Low proceed probability', 'simulation', 'global',
   'probability_proceed < 25 (Ultimate tier)', 'score_lte', '{"max":24,"tier":"ultimate"}',
   'HARD_BLOCKER', 'PIVOT', 'Simulation probability of success is too low on the current path.', true)
ON CONFLICT (rule_id) DO UPDATE SET
  rule_name = EXCLUDED.rule_name,
  applies_to_engine = EXCLUDED.applies_to_engine,
  dimension = EXCLUDED.dimension,
  condition_description = EXCLUDED.condition_description,
  threshold_type = EXCLUDED.threshold_type,
  threshold_value = EXCLUDED.threshold_value,
  severity = EXCLUDED.severity,
  verdict_effect = EXCLUDED.verdict_effect,
  user_visible_reason = EXCLUDED.user_visible_reason,
  active = EXCLUDED.active;
--> statement-breakpoint

-- Capability graph expansion to minimum 20 nodes (Prompt 1 TASK 4)
INSERT INTO erector_capability_graph (
  capability_id, capability_name, capability_description, domain,
  proof_required, evidence_types_allowed, minimum_signal_threshold
) VALUES
  ('CAP-pricing-strategy-01', 'Pricing Strategy', 'Ability to set and test pricing that customers accept', 'market',
   'Tested price points with conversion or willingness-to-pay data', ARRAY['CUSTOMER_SIGNAL', 'PAYMENT_PROOF'], 60),
  ('CAP-financial-modeling-01', 'Financial Modeling', 'Ability to build and maintain a basic financial model', 'operations',
   'Spreadsheet or model with real assumptions and scenarios', ARRAY['STRUCTURED_PROOF', 'DIRECT_ARTIFACT'], 55),
  ('CAP-partnership-dev-01', 'Partnership Development', 'Ability to establish strategic partnerships', 'growth',
   'Signed MOU, LOI, or active partnership with documented terms', ARRAY['DIRECT_ARTIFACT', 'CUSTOMER_SIGNAL'], 65),
  ('CAP-customer-support-01', 'Customer Support', 'Ability to resolve customer issues reliably', 'delivery',
   'Documented support process with resolution time metrics', ARRAY['CUSTOMER_SIGNAL', 'ANALYTICS_MOVEMENT'], 60),
  ('CAP-product-positioning-01', 'Product Positioning', 'Ability to articulate clear product positioning', 'market',
   'Positioning statement validated by target customer feedback', ARRAY['CUSTOMER_SIGNAL', 'STRUCTURED_PROOF'], 60),
  ('CAP-email-marketing-01', 'Email Marketing', 'Ability to grow and engage an email list', 'growth',
   'Email campaign with measurable open/click/conversion rates', ARRAY['ANALYTICS_MOVEMENT', 'DIRECT_ARTIFACT'], 55),
  ('CAP-legal-compliance-01', 'Legal Compliance', 'Ability to meet basic regulatory requirements', 'operations',
   'Compliance checklist completed with documented filings or counsel review', ARRAY['DIRECT_ARTIFACT', 'STRUCTURED_PROOF'], 65),
  ('CAP-hiring-delegation-01', 'Hiring & Delegation', 'Ability to delegate work effectively', 'operations',
   'Delegated task completed by another person with quality proof', ARRAY['TASK_COMPLETION_COUNT', 'DIRECT_ARTIFACT'], 60),
  ('CAP-data-analytics-01', 'Data Analytics', 'Ability to track and interpret key business metrics', 'growth',
   'Dashboard or report used for a real business decision', ARRAY['ANALYTICS_MOVEMENT', 'STRUCTURED_PROOF'], 60),
  ('CAP-networking-01', 'Professional Networking', 'Ability to build relationships that advance the business', 'market',
   'Documented introductions or meetings that led to business opportunities', ARRAY['CUSTOMER_SIGNAL', 'DIRECT_ARTIFACT'], 55)
ON CONFLICT (capability_id) DO NOTHING;
