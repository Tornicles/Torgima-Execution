-- GAP G4 — ensure active blueprints have non-zero state_version (DOC_15)

UPDATE blueprints SET state_version = 1 WHERE state_version = 0 AND status = 'active';
