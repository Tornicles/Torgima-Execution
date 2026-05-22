-- Erector Prompt 3: blocked verdict and blocked_reality readiness
ALTER TYPE validation_verdict ADD VALUE IF NOT EXISTS 'blocked';
ALTER TYPE validation_readiness ADD VALUE IF NOT EXISTS 'blocked_reality';
