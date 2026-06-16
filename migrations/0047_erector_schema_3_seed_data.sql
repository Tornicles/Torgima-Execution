-- ERECTOR SCHEMA 3 — seed erector_model_versions (10 components, v0.1)

INSERT INTO erector_model_versions (component, current_version, changelog) VALUES
  ('validation_model', 'v0.1', 'Validation scoring and verdict rule engine'),
  ('simulation_model', 'v0.1', 'Simulation scoring and scenario generation'),
  ('economic_type_model', 'v0.1', 'Archetype classifier and router'),
  ('archetype_rule_pack', 'v0.1', 'All 10 archetype rule packs'),
  ('academy_rule', 'v0.1', 'Academy trigger and capability gap rules'),
  ('outcome_validation', 'v0.1', 'Outcome scoring and false progress detection'),
  ('framework_rule', 'v0.1', 'Framework veto rules'),
  ('signal_calculation', 'v0.1', '13 Erector signal calculation methods'),
  ('proof_standard', 'v0.1', 'Evidence classification and strength scoring'),
  ('threshold_matrix', 'v0.1', 'v0.1 verdict thresholds per tier')
ON CONFLICT (component) DO NOTHING;
