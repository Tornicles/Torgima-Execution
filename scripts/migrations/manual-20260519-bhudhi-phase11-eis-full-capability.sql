-- Prompt 11: EIS full capability, competitor intelligence, trend velocity, narrative layer.

create table if not exists competitor_intelligence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  domain text not null,
  niche text,
  competitors jsonb not null default '[]'::jsonb,
  activity_window text not null default '24h',
  key_findings jsonb not null default '[]'::jsonb,
  threat_level text not null default 'LOW',
  opportunity_flags jsonb not null default '[]'::jsonb,
  research_method text not null default 'FALLBACK',
  confidence_tier text not null default 'LOW',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_competitor_intelligence_user_created
  on competitor_intelligence(user_id, created_at);
create index if not exists idx_competitor_intelligence_expires
  on competitor_intelligence(expires_at);

create table if not exists trend_intelligence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  domain text not null,
  niche text,
  trends jsonb not null default '[]'::jsonb,
  velocity_scores jsonb not null default '[]'::jsonb,
  emerging_trends jsonb not null default '[]'::jsonb,
  peaking_trends jsonb not null default '[]'::jsonb,
  declining_trends jsonb not null default '[]'::jsonb,
  opportunity_windows jsonb not null default '[]'::jsonb,
  research_method text not null default 'FALLBACK',
  confidence_tier text not null default 'LOW',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trend_intelligence_user_created
  on trend_intelligence(user_id, created_at);
create index if not exists idx_trend_intelligence_expires
  on trend_intelligence(expires_at);

create table if not exists narrative_intelligence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  domain text not null,
  niche text,
  dominant_narrative text not null,
  emerging_narratives jsonb not null default '[]'::jsonb,
  sentiment_signal text not null default 'NEUTRAL',
  audience_emotions jsonb not null default '[]'::jsonb,
  content_angle text not null,
  risk_narratives jsonb not null default '[]'::jsonb,
  research_method text not null default 'FALLBACK',
  confidence_tier text not null default 'LOW',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_narrative_intelligence_user_created
  on narrative_intelligence(user_id, created_at);
create index if not exists idx_narrative_intelligence_expires
  on narrative_intelligence(expires_at);

create table if not exists platform_algorithm_signals (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  signal_type text not null default 'UNKNOWN',
  content_category text not null,
  signal_strength double precision not null default 0.5,
  confidence_tier text not null default 'LOW',
  source_evidence text not null,
  recommendation text not null,
  valid_until timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_algorithm_signals_platform
  on platform_algorithm_signals(platform);
create index if not exists idx_platform_algorithm_signals_valid_until
  on platform_algorithm_signals(valid_until);
