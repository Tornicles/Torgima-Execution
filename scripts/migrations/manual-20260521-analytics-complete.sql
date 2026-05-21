-- PROMPT 7 — Analytics & dashboards (execution, principles, academy, content)

-- Stage 1: Execution
CREATE TABLE IF NOT EXISTS execution_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  total_orders_created INT NOT NULL DEFAULT 0,
  total_orders_completed INT NOT NULL DEFAULT 0,
  completion_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  partial_completions INT NOT NULL DEFAULT 0,
  failed_orders INT NOT NULL DEFAULT 0,
  skipped_orders INT NOT NULL DEFAULT 0,
  average_order_score DOUBLE PRECISION,
  average_time_to_complete INT,
  orders_completed_on_time INT NOT NULL DEFAULT 0,
  orders_completed_late INT NOT NULL DEFAULT 0,
  execution_momentum DOUBLE PRECISION NOT NULL DEFAULT 0,
  condition_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  peak_productivity_hour INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, metric_date)
);

CREATE TABLE IF NOT EXISTS execution_velocity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start_date DATE NOT NULL,
  window_end_date DATE NOT NULL,
  window_type TEXT NOT NULL DEFAULT 'daily',
  orders_completed INT NOT NULL DEFAULT 0,
  orders_per_day DOUBLE PRECISION NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'stable',
  trend_percentage DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  pattern_description TEXT NOT NULL,
  frequency INT NOT NULL DEFAULT 0,
  impact DOUBLE PRECISION NOT NULL DEFAULT 0,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actionable_insight TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS failure_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  failed_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  failure_reason TEXT,
  failure_category TEXT,
  severity INT NOT NULL DEFAULT 3,
  pattern_count INT NOT NULL DEFAULT 1,
  prediction_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  suggested_prevention TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS productivity_heatmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  hour_of_day INT NOT NULL,
  orders_completed INT NOT NULL DEFAULT 0,
  completion_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  average_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, day_of_week, hour_of_day)
);

CREATE TABLE IF NOT EXISTS execution_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  current_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  personal_best DOUBLE PRECISION,
  personal_worst DOUBLE PRECISION,
  average_value DOUBLE PRECISION,
  trend TEXT NOT NULL DEFAULT 'stable',
  days_to_beat_record INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, metric_name)
);

-- Stage 2: Principles
CREATE TABLE IF NOT EXISTS principle_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principle_id UUID REFERENCES principles(id) ON DELETE SET NULL,
  metric_date DATE NOT NULL,
  applied_today BOOLEAN NOT NULL DEFAULT false,
  streak_count INT NOT NULL DEFAULT 0,
  proof_submitted BOOLEAN NOT NULL DEFAULT false,
  content_published BOOLEAN NOT NULL DEFAULT false,
  content_platforms INT NOT NULL DEFAULT 0,
  total_engagement INT NOT NULL DEFAULT 0,
  correlation_to_execution DOUBLE PRECISION,
  applied_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS principle_effectiveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principle_id UUID NOT NULL REFERENCES principles(id) ON DELETE CASCADE,
  effectiveness_score DOUBLE PRECISION NOT NULL DEFAULT 50,
  application_count INT NOT NULL DEFAULT 0,
  average_order_score_when_applied DOUBLE PRECISION,
  average_order_score_when_not_applied DOUBLE PRECISION,
  correlation_strength DOUBLE PRECISION NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'stable',
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, principle_id)
);

CREATE TABLE IF NOT EXISTS principle_content_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principle_id UUID REFERENCES principles(id) ON DELETE SET NULL,
  content_id UUID,
  platform TEXT NOT NULL,
  engagement_count INT NOT NULL DEFAULT 0,
  engagement_rate DOUBLE PRECISION,
  reach INT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS principle_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principle_id UUID REFERENCES principles(id) ON DELETE SET NULL,
  insight_type TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  actionable_recommendation TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stage 3: Academy
CREATE TABLE IF NOT EXISTS academy_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  courses_in_progress INT NOT NULL DEFAULT 0,
  courses_completed INT NOT NULL DEFAULT 0,
  lessons_completed INT NOT NULL DEFAULT 0,
  average_lesson_score DOUBLE PRECISION,
  total_study_time_minutes INT NOT NULL DEFAULT 0,
  concepts_mastered INT NOT NULL DEFAULT 0,
  concepts_weak INT NOT NULL DEFAULT 0,
  average_practice_score DOUBLE PRECISION,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, metric_date)
);

CREATE TABLE IF NOT EXISTS concept_mastery_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL,
  mastery_level DOUBLE PRECISION NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  successful_attempts INT NOT NULL DEFAULT 0,
  average_time_to_solve INT,
  improvement_trend DOUBLE PRECISION,
  retention_decay DOUBLE PRECISION,
  next_review_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, concept_id)
);

CREATE TABLE IF NOT EXISTS learning_velocity_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start_date DATE NOT NULL,
  window_end_date DATE NOT NULL,
  window_type TEXT NOT NULL DEFAULT 'weekly',
  lessons_completed INT NOT NULL DEFAULT 0,
  hours_studied DOUBLE PRECISION NOT NULL DEFAULT 0,
  concepts_mastered INT NOT NULL DEFAULT 0,
  velocity_trend TEXT NOT NULL DEFAULT 'stable',
  estimated_completion_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS practice_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_item_id TEXT NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  first_attempt_correct BOOLEAN,
  average_score DOUBLE PRECISION,
  improvement_from_first DOUBLE PRECISION,
  time_investment INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, practice_item_id)
);

CREATE TABLE IF NOT EXISTS weak_areas_detected (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL,
  weakness_description TEXT NOT NULL,
  mastery_level DOUBLE PRECISION NOT NULL DEFAULT 0,
  attempts_failed INT NOT NULL DEFAULT 0,
  common_mistake TEXT,
  recommended_action TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stage 4: Content
CREATE TABLE IF NOT EXISTS content_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  posts_published INT NOT NULL DEFAULT 0,
  total_engagement INT NOT NULL DEFAULT 0,
  average_engagement_per_post DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_reach INT NOT NULL DEFAULT 0,
  total_impressions INT NOT NULL DEFAULT 0,
  audience_growth_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  best_performing_content_id UUID,
  best_performing_platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, metric_date)
);

CREATE TABLE IF NOT EXISTS platform_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  metric_date DATE NOT NULL,
  posts_published INT NOT NULL DEFAULT 0,
  total_engagement INT NOT NULL DEFAULT 0,
  total_reach INT NOT NULL DEFAULT 0,
  total_impressions INT NOT NULL DEFAULT 0,
  average_engagement_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  top_post_engagement INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, platform, metric_date)
);

CREATE TABLE IF NOT EXISTS post_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principle_id UUID REFERENCES principles(id) ON DELETE SET NULL,
  post_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  title TEXT,
  content_summary TEXT,
  published_at TIMESTAMPTZ,
  likes INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0,
  shares INT NOT NULL DEFAULT 0,
  retweets INT NOT NULL DEFAULT 0,
  views INT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  reach INT NOT NULL DEFAULT 0,
  engagement_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  virality_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  audience_segment_reached JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, post_id, platform)
);

CREATE TABLE IF NOT EXISTS audience_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  platform TEXT NOT NULL,
  total_followers INT NOT NULL DEFAULT 0,
  new_followers INT NOT NULL DEFAULT 0,
  growth_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  engagement_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  top_follower_segment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, metric_date, platform)
);

CREATE TABLE IF NOT EXISTS content_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  actionable_recommendation TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stage 5: Consolidated insights cache
CREATE TABLE IF NOT EXISTS analytics_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_analytics_user_date ON execution_analytics(user_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_principle_effectiveness_user ON principle_effectiveness(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_analytics_user_date ON academy_analytics(user_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_content_analytics_user_date ON content_analytics(user_id, metric_date DESC);
