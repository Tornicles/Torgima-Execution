-- Prompt 12: dashboard intelligence surface.

create table if not exists dashboard_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  strategic_outlook jsonb,
  behavioral_insight jsonb,
  blueprint_health jsonb,
  signal_narrative jsonb,
  execution_brief jsonb,
  governance_summary jsonb,
  last_refreshed timestamptz not null default now(),
  snapshot_version integer not null default 1,
  world_state_version integer not null default 0
);

create index if not exists idx_dashboard_intelligence_user
  on dashboard_intelligence_snapshots(user_id);

create table if not exists strategic_outlook_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  execution_forecast text not null,
  risk_factors jsonb not null default '[]'::jsonb,
  opportunity_flags jsonb not null default '[]'::jsonb,
  highest_leverage_action text not null,
  condition_prediction text not null,
  momentum_trajectory text not null default 'STABLE',
  confidence_tier text not null default 'LOW',
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_strategic_outlook_user_generated
  on strategic_outlook_records(user_id, generated_at);
create index if not exists idx_strategic_outlook_expires
  on strategic_outlook_records(expires_at);

create table if not exists behavioral_insight_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  insight_type text not null,
  insight_text text not null,
  evidence_summary text not null,
  action_suggestion text,
  trigger_event text not null,
  seen boolean not null default false,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_behavioral_insights_user_seen
  on behavioral_insight_records(user_id, seen, dismissed);
create index if not exists idx_behavioral_insights_created
  on behavioral_insight_records(created_at);
