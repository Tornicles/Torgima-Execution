-- ERECTOR SCHEMA 1 — PART 9 seed data (v0.1)
-- Idempotent: ON CONFLICT DO NOTHING on unique keys.

-- Threshold matrix (3 tiers)
INSERT INTO erector_threshold_matrix (
  tier, proceed_min_score, adjust_min_score, pivot_max_score, demand_proof_min_class
) VALUES
  ('starter', 60, 40, 39, 2),
  ('growth', 70, 45, 44, 3),
  ('ultimate', 75, 50, 49, 4)
ON CONFLICT (tier) DO NOTHING;
--> statement-breakpoint

-- Archetype rule packs (10 archetypes)
INSERT INTO erector_archetype_rule_packs (
  archetype_id, archetype_name, core_risk, risk_level,
  minimum_demand_proof_class, demand_proof_description, proof_description,
  capital_pressure, timeline_pressure, typical_months_to_traction
) VALUES
  ('marketplace_exchange', 'Marketplace Exchange', 'liquidity — needs both sides', 'high', 4,
   'Requires demonstrated two-sided demand before launch', 'Signed LOIs or pilot transactions from both supply and demand sides', 'high', 'high', 18),
  ('direct_service_delivery', 'Direct Service Delivery', 'capacity ceiling', 'medium', 3,
   'Requires paying customers or firm commitments', 'Deposit, signed contract, or recurring service agreement', 'low-medium', 'medium', 6),
  ('information_knowledge_product', 'Information / Knowledge Product', 'distribution gap', 'medium', 3,
   'Requires audience or distribution channel proof', 'Email list, pre-sales, or content traction metrics', 'medium', 'medium', 9),
  ('subscription_recurring', 'Subscription / Recurring', 'churn rate', 'medium', 4,
   'Requires retention signal or prepaid subscribers', 'Trial-to-paid conversion data or annual prepay', 'medium', 'medium', 12),
  ('physical_product_inventory', 'Physical Product / Inventory', 'inventory risk', 'high', 4,
   'Requires pre-orders or wholesale commitments', 'Pre-order volume covering first production run', 'high', 'high', 12),
  ('consulting_advisory', 'Consulting / Advisory', 'positioning clarity', 'medium', 3,
   'Requires scoped engagements or retainer commitments', 'Signed SOW, retainer, or paid discovery session', 'low-medium', 'low', 4),
  ('saas_platform', 'SaaS Platform', 'build cost + retention', 'high', 4,
   'Requires usage retention or paid pilots', 'Paid pilot, active usage cohort, or LOI from enterprise buyer', 'high', 'high', 18),
  ('content_media', 'Content / Media', 'algorithm dependency', 'medium-high', 3,
   'Requires audience growth or sponsorship commitments', 'Sponsor LOI, subscriber growth curve, or ad revenue pilot', 'medium-high', 'medium', 9),
  ('social_enterprise_mission', 'Social Enterprise / Mission', 'funding dependency', 'medium', 3,
   'Requires grant, donor, or impact buyer commitment', 'Grant award letter, donor pledge, or impact contract', 'medium', 'medium', 12),
  ('collective_community', 'Collective / Community', 'participation + retention', 'medium', 4,
   'Requires active member participation metrics', 'Member activation rate and 30-day retention above threshold', 'medium', 'medium', 12)
ON CONFLICT (archetype_id) DO NOTHING;
--> statement-breakpoint

-- Framework veto rules (4 Individual Access frameworks)
INSERT INTO erector_framework_veto_rules (
  framework_id, framework_name, active_individual, condition_description,
  veto_type, verdict_effect, correction_required, user_visible_reason
) VALUES
  ('strategy_core', 'StrategyCore', true,
   'Strategic coherence score below minimum without corrective narrative',
   'SOFT_VETO', 'ADJUST', 'Revise goal positioning and competitive differentiation',
   'Your strategy needs sharper positioning before we can proceed.'),
  ('customer_value', 'CustomerValue', true,
   'Customer value proof class below tier minimum',
   'HARD_VETO', 'PIVOT', 'Collect stronger customer validation evidence',
   'We need clearer proof that customers will pay for this.'),
  ('synergy_ops', 'SynergyOps', true,
   'Operational capacity insufficient for stated timeline',
   'SOFT_VETO', 'ADJUST', 'Adjust timeline or resource plan',
   'Your timeline does not match your available operational capacity.'),
  ('governance_risk', 'Governance & Risk', true,
   'Regulatory or compliance risk flag unresolved',
   'HARD_VETO', 'PIVOT', 'Resolve compliance blockers or change model',
   'A compliance or governance risk must be addressed before launch.')
ON CONFLICT (framework_id) DO NOTHING;
--> statement-breakpoint

-- Verdict rules (~40 v0.1 rules across dimensions)
INSERT INTO erector_verdict_rules (
  rule_id, rule_name, applies_to_engine, dimension, condition_description,
  threshold_type, threshold_value, severity, verdict_effect, user_visible_reason
) VALUES
  ('VR-001', 'Market viability critical', 'validation', 'market', 'Market viability score below 20', 'score_lte', '{"max":20}', 'HARD_BLOCKER', 'PIVOT', 'Market conditions are too weak for this idea as stated.'),
  ('VR-002', 'Market viability weak', 'validation', 'market', 'Market viability score 21-39', 'score_lte', '{"max":39,"min":21}', 'SOFT_BLOCKER', 'ADJUST', 'Market viability is weak — refine positioning or target segment.'),
  ('VR-003', 'Market viability unstable', 'validation', 'market', 'Market viability score 40-59', 'combo', '{"min":40,"max":59}', 'WARNING', 'ADJUST', 'Market signal is unstable — strengthen market proof.'),
  ('VR-004', 'Market viability viable', 'validation', 'market', 'Market viability score 60-79', 'score_gte', '{"min":60}', 'INFO', 'NONE', 'Market viability is acceptable.'),
  ('VR-005', 'Market viability strong', 'validation', 'market', 'Market viability score 80+', 'score_gte', '{"min":80}', 'INFO', 'NONE', 'Strong market viability detected.'),
  ('VR-006', 'Demand proof absent', 'validation', 'demand', 'Demand proof class 0', 'class_gte', '{"min":1}', 'HARD_BLOCKER', 'PIVOT', 'No demand proof detected — validate willingness to pay first.'),
  ('VR-007', 'Demand proof weak', 'validation', 'demand', 'Demand proof class 1', 'class_gte', '{"min":2}', 'SOFT_BLOCKER', 'ADJUST', 'Demand proof is too weak for your tier.'),
  ('VR-008', 'Demand proof below tier', 'validation', 'demand', 'Demand proof below tier minimum', 'class_gte', '{"tier_min":true}', 'SOFT_BLOCKER', 'ADJUST', 'Collect stronger customer validation before proceeding.'),
  ('VR-009', 'Demand proof adequate', 'validation', 'demand', 'Demand proof meets tier minimum', 'class_gte', '{"tier_min":true}', 'INFO', 'NONE', 'Demand proof meets the minimum for your plan.'),
  ('VR-010', 'Demand proof strong', 'validation', 'demand', 'Demand proof class 5', 'class_gte', '{"min":5}', 'INFO', 'NONE', 'Exceptional demand proof detected.'),
  ('VR-011', 'Feasibility blocked', 'validation', 'feasibility', 'Feasibility rating blocked', 'flag_present', '{"flag":"blocked"}', 'HARD_BLOCKER', 'PIVOT', 'This plan is not feasible with current constraints.'),
  ('VR-012', 'Feasibility unlikely', 'validation', 'feasibility', 'Feasibility rating unlikely', 'flag_present', '{"flag":"unlikely"}', 'HARD_BLOCKER', 'PIVOT', 'Feasibility is unlikely — major constraints must change.'),
  ('VR-013', 'Feasibility stretched', 'validation', 'feasibility', 'Feasibility rating stretched', 'flag_present', '{"flag":"stretched"}', 'SOFT_BLOCKER', 'ADJUST', 'Timeline or resources are stretched — adjust the plan.'),
  ('VR-014', 'Feasibility possible', 'validation', 'feasibility', 'Feasibility rating possible', 'flag_present', '{"flag":"possible"}', 'WARNING', 'NONE', 'Plan is possible with discipline.'),
  ('VR-015', 'Feasibility strong', 'validation', 'feasibility', 'Feasibility rating strongly_feasible', 'flag_present', '{"flag":"strongly_feasible"}', 'INFO', 'NONE', 'Strong feasibility profile.'),
  ('VR-016', 'Context readiness critical', 'validation', 'context', 'Context readiness below 30', 'score_lte', '{"max":30}', 'SOFT_BLOCKER', 'ADJUST', 'You need more context readiness — skills, budget, or support.'),
  ('VR-017', 'Context readiness weak', 'validation', 'context', 'Context readiness 30-49', 'combo', '{"min":30,"max":49}', 'WARNING', 'ADJUST', 'Context readiness is weak for this ambition.'),
  ('VR-018', 'Context readiness adequate', 'validation', 'context', 'Context readiness 50+', 'score_gte', '{"min":50}', 'INFO', 'NONE', 'Context readiness is adequate.'),
  ('VR-019', 'Contradiction detected', 'validation', 'global', 'Contradiction score above 50', 'score_gte', '{"min":51}', 'HARD_BLOCKER', 'ADJUST', 'Your inputs contradict each other — reconcile before proceeding.'),
  ('VR-020', 'Contradiction warning', 'validation', 'global', 'Contradiction score 21-50', 'combo', '{"min":21,"max":50}', 'WARNING', 'ADJUST', 'Some contradictions detected in your inputs.'),
  ('VR-021', 'Evidence quality low', 'validation', 'global', 'Evidence quality below 40', 'score_lte', '{"max":40}', 'WARNING', 'ADJUST', 'Evidence quality is low — add stronger proof.'),
  ('VR-022', 'Overall score pivot', 'validation', 'global', 'Overall validation at or below pivot max', 'score_lte', '{"tier_pivot":true}', 'HARD_BLOCKER', 'PIVOT', 'Overall validation score requires a pivot.'),
  ('VR-023', 'Overall score adjust', 'validation', 'global', 'Overall between adjust and proceed bands', 'combo', '{"tier_adjust":true}', 'SOFT_BLOCKER', 'ADJUST', 'Validation suggests adjustments before full proceed.'),
  ('VR-024', 'Overall score proceed', 'validation', 'global', 'Overall at or above proceed minimum', 'score_gte', '{"tier_proceed":true}', 'INFO', 'NONE', 'Validation supports proceeding.'),
  ('VR-025', 'Risk score elevated', 'validation', 'global', 'Risk score above 70', 'score_gte', '{"min":71}', 'WARNING', 'ADJUST', 'Elevated risk detected — review risk flags.'),
  ('VR-026', 'Confidence low', 'validation', 'global', 'Confidence score below 40', 'score_lte', '{"max":40}', 'WARNING', 'ADJUST', 'Validation confidence is low — gather more evidence.'),
  ('VR-027', 'Simulation veto active', 'simulation', 'global', 'Hard framework veto active', 'flag_present', '{"flag":"veto_active"}', 'HARD_BLOCKER', 'PIVOT', 'A framework veto blocks launch — resolve before continuing.'),
  ('VR-028', 'Simulation soft risk', 'simulation', 'global', 'Soft framework risks present', 'flag_present', '{"flag":"soft_risks"}', 'WARNING', 'ADJUST', 'Simulation surfaced risks that need attention.'),
  ('VR-029', 'Simulation proceed probability low', 'simulation', 'global', 'Proceed probability below 40', 'score_lte', '{"max":40}', 'SOFT_BLOCKER', 'ADJUST', 'Simulation suggests low probability of success on current path.'),
  ('VR-030', 'Simulation proceed probability adequate', 'simulation', 'global', 'Proceed probability 40+', 'score_gte', '{"min":40}', 'INFO', 'NONE', 'Simulation supports the selected path.'),
  ('VR-031', 'Phase gate demand unmet', 'phase_gate', 'demand', 'Demand proof below archetype minimum at phase gate', 'class_gte', '{"archetype_min":true}', 'HARD_BLOCKER', 'ADJUST', 'Phase gate blocked — demand proof insufficient.'),
  ('VR-032', 'Phase gate evidence missing', 'phase_gate', 'global', 'Required evidence not in ledger', 'flag_present', '{"flag":"missing_evidence"}', 'SOFT_BLOCKER', 'ADJUST', 'Required evidence missing for this phase.'),
  ('VR-033', 'False progress pattern', 'validation', 'global', 'False progress pattern detected', 'flag_present', '{"flag":"false_progress"}', 'WARNING', 'ADJUST', 'Activity detected without meaningful outcome movement.'),
  ('VR-034', 'Academy proof failure', 'validation', 'context', 'Academy proof requirement unmet', 'flag_present', '{"flag":"academy_incomplete"}', 'SOFT_BLOCKER', 'ADJUST', 'Complete required academy proof before proceeding.'),
  ('VR-035', 'Economic model failure', 'validation', 'feasibility', 'Unit economics below archetype floor', 'flag_present', '{"flag":"unit_economics_fail"}', 'HARD_BLOCKER', 'PIVOT', 'Unit economics do not support this model.'),
  ('VR-036', 'Starter tier demand relax', 'validation', 'demand', 'Starter tier demand class 2 minimum', 'class_gte', '{"min":2,"tier":"starter"}', 'INFO', 'NONE', 'Starter tier demand minimum met.'),
  ('VR-037', 'Growth tier demand strict', 'validation', 'demand', 'Growth tier demand class 3 minimum', 'class_gte', '{"min":3,"tier":"growth"}', 'INFO', 'NONE', 'Growth tier demand minimum met.'),
  ('VR-038', 'Ultimate tier demand strict', 'validation', 'demand', 'Ultimate tier demand class 4 minimum', 'class_gte', '{"min":4,"tier":"ultimate"}', 'INFO', 'NONE', 'Ultimate tier demand minimum met.'),
  ('VR-039', 'Hybrid archetype review', 'validation', 'market', 'Hybrid archetype classification', 'flag_present', '{"flag":"is_hybrid"}', 'WARNING', 'ADJUST', 'Hybrid model detected — confirm dominant revenue path.'),
  ('VR-040', 'Launch contract required', 'validation', 'global', 'No permitted launch contract', 'flag_present', '{"flag":"no_launch_contract"}', 'HARD_BLOCKER', 'ADJUST', 'Blueprint cannot launch without a permitted launch contract.')
ON CONFLICT (rule_id) DO NOTHING;
