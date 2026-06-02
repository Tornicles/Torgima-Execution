CREATE TYPE "public"."action_type" AS ENUM('create', 'replicate', 'analyze', 'improve', 'standardize', 'recover', 'test', 'publish', 'validate', 'measure', 'build');--> statement-breakpoint
CREATE TYPE "public"."ai_mode" AS ENUM('command', 'correction', 'stabilization', 'optimization', 'expansion', 'strategic', 'analytical');--> statement-breakpoint
CREATE TYPE "public"."behavior_pattern_status" AS ENUM('active', 'resolved', 'ignored', 'monitoring');--> statement-breakpoint
CREATE TYPE "public"."behavior_pattern_type" AS ENUM('procrastination', 'burnout', 'inconsistency', 'avoidance', 'fake_completion', 'low_reflection', 'blocker_repetition', 'inactivity', 'score_inflation', 'difficulty_ceiling', 'task_type_avoidance', 'recovery_dependence', 'false_progress', 'focus_drift');--> statement-breakpoint
CREATE TYPE "public"."bhudhi_execution_context" AS ENUM('marketing', 'pr', 'strategy', 'execution', 'analysis');--> statement-breakpoint
CREATE TYPE "public"."bhudhi_request_type" AS ENUM('goal_validation', 'blueprint_generation', 'policy_generation', 'task_generation', 'task_regeneration', 'feedback_interpretation', 'feedback_interrogation', 'condition_explanation', 'recovery_suggestion', 'academy_content', 'knowledge_generation', 'behavior_analysis', 'dashboard_summary', 'other');--> statement-breakpoint
CREATE TYPE "public"."bhudhi_trigger_type" AS ENUM('task_generation', 'feedback_interpretation', 'feedback_interrogation', 'goal_structuring', 'validation_analysis', 'condition_explanation', 'state_explanation', 'blocker_classification', 'pattern_summary', 'evidence_summary', 'root_cause_candidates', 'pivot_path_generation', 'academy_content', 'knowledge_update', 'blueprint_generation', 'blueprint_interpretation', 'erector_analysis');--> statement-breakpoint
CREATE TYPE "public"."blueprint_operational_state" AS ENUM('ACTIVE', 'STALLED', 'DEGRADED', 'RECOVERY', 'COLLAPSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."blueprint_status" AS ENUM('draft', 'validating', 'awaiting_selection', 'path_selection', 'active', 'paused', 'complete', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."capability_level" AS ENUM('beginner', 'operator', 'advanced', 'lead');--> statement-breakpoint
CREATE TYPE "public"."commitment_level" AS ENUM('low', 'medium', 'high', 'full');--> statement-breakpoint
CREATE TYPE "public"."condition" AS ENUM('nothingness', 'danger', 'urgency', 'stability', 'power', 'affluence', 'power_change');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('very_easy', 'easy', 'moderate', 'hard', 'very_hard');--> statement-breakpoint
CREATE TYPE "public"."domain" AS ENUM('genesis', 'market', 'delivery', 'operations', 'people', 'growth', 'continuity');--> statement-breakpoint
CREATE TYPE "public"."domain_transition_trigger" AS ENUM('validation_complete', 'blueprint_launched', 'signal_change', 'condition_change', 'strategy_pivot', 'manual_review', 'phase_complete', 'recovery_mode');--> statement-breakpoint
CREATE TYPE "public"."event_log_result" AS ENUM('success', 'retry', 'failed', 'dead_lettered', 'noop_duplicate');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('pending', 'claimed', 'processed', 'retry_pending', 'dead_lettered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."fatigue_risk" AS ENUM('low', 'moderate', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."framework_activation_level" AS ENUM('dormant', 'monitor', 'diagnose', 'recommend', 'enforce');--> statement-breakpoint
CREATE TYPE "public"."framework_decision_status" AS ENUM('proposed', 'approved', 'rejected', 'applied', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."framework_name" AS ENUM('governance_risk', 'finmatrix', 'strategycore', 'synergyops', 'talentsync', 'alignment_accountability', 'customervalue', 'omnigrowth', 'adaptive_intelligence', 'knowledgeflow', 'decision_velocity', 'culture_dynamics', 'regeneration_exit', 'clarity_catalyst');--> statement-breakpoint
CREATE TYPE "public"."generation_mode" AS ENUM('initial', 'post_feedback', 'daily', 'recovery', 'condition_change');--> statement-breakpoint
CREATE TYPE "public"."generation_trigger" AS ENUM('blueprint_launched', 'feedback_submitted', 'condition_changed', 'task_completed', 'task_blocked', 'user_inactive', 'phase_checkpoint_required', 'academy_gap_detected', 'weekly_review_due', 'habit_check_due', 'dependency_unblocked', 'daily_cycle', 'recovery_triggered', 'manual_regeneration');--> statement-breakpoint
CREATE TYPE "public"."identity_stage" AS ENUM('starting', 'forming', 'building', 'establishing', 'consolidated', 'transforming');--> statement-breakpoint
CREATE TYPE "public"."inactivity_threshold" AS ENUM('warning', 'soft', 'hard', 'critical');--> statement-breakpoint
CREATE TYPE "public"."intelligence_depth" AS ENUM('guided', 'operational', 'strategic');--> statement-breakpoint
CREATE TYPE "public"."milestone_type" AS ENUM('task_streak', 'phase_complete', 'project_complete', 'target_hit', 'blueprint_complete', 'comeback', 'score_improvement', 'capability_level_up');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'active', 'paused', 'blocked', 'needs_feedback', 'needs_proof', 'completed', 'failed', 'skipped', 'cancelled', 'pre_generated');--> statement-breakpoint
CREATE TYPE "public"."phase_name" AS ENUM('initiation', 'development', 'completion');--> statement-breakpoint
CREATE TYPE "public"."phase_permission" AS ENUM('restricted', 'blocked', 'normal', 'accelerated');--> statement-breakpoint
CREATE TYPE "public"."phase_status" AS ENUM('pending', 'active', 'gated', 'blocked', 'complete', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('pending', 'active', 'complete', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('pending', 'active', 'blocked', 'complete', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('setup', 'execution', 'analysis', 'optimization', 'recovery');--> statement-breakpoint
CREATE TYPE "public"."proof_type" AS ENUM('link', 'file', 'text', 'image', 'none');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."season_name" AS ENUM('ignition', 'foundation', 'traction', 'scale');--> statement-breakpoint
CREATE TYPE "public"."selected_path" AS ENUM('current', 'adjusted', 'alternative');--> statement-breakpoint
CREATE TYPE "public"."signal_confidence" AS ENUM('insufficient_data', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."signal_trend" AS ENUM('rising', 'stable', 'declining', 'recovering', 'volatile');--> statement-breakpoint
CREATE TYPE "public"."target_adjustment" AS ENUM('reduce', 'maintain', 'expand');--> statement-breakpoint
CREATE TYPE "public"."target_status" AS ENUM('pending', 'active', 'on_track', 'at_risk', 'complete', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('major', 'primary', 'vital', 'operating', 'production', 'conditional');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('execution', 'recovery', 'academy', 'clarification', 'blocker_resolution', 'phase_checkpoint', 'habit', 'review', 'smoke_test');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'strategist', 'operator', 'contributor', 'reviewer', 'observer');--> statement-breakpoint
CREATE TYPE "public"."throughput" AS ENUM('very_low', 'low', 'moderate', 'high', 'very_high');--> statement-breakpoint
CREATE TYPE "public"."ui_mode" AS ENUM('starter', 'restrictive', 'focused', 'standard', 'expanded', 'strategic', 'transitional');--> statement-breakpoint
CREATE TYPE "public"."user_mode" AS ENUM('individual', 'team');--> statement-breakpoint
CREATE TYPE "public"."user_tier" AS ENUM('starter', 'growth', 'ultimate');--> statement-breakpoint
CREATE TYPE "public"."validation_kind" AS ENUM('legacy', 'intelligence', 'erector', 'readiness', 'path_selection', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."validation_readiness" AS ENUM('not_ready', 'partial', 'ready_proceed', 'ready_with_adjustment', 'blocked_pivot', 'blocked_reality');--> statement-breakpoint
CREATE TYPE "public"."validation_verdict" AS ENUM('proceed', 'adjust', 'pivot', 'blocked');--> statement-breakpoint
CREATE TABLE "academy_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"learning_objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_duration_minutes" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_concept_mastery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"concept_id" text NOT NULL,
	"mastery_level" double precision DEFAULT 0 NOT NULL,
	"first_attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"successful_attempts" integer DEFAULT 0 NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"difficulty_level" text DEFAULT 'beginner' NOT NULL,
	"estimated_duration_hours" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_generated_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"topic" text NOT NULL,
	"generated_content" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_learning_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_title" text NOT NULL,
	"target_skill" text NOT NULL,
	"target_mastery_level" integer DEFAULT 80 NOT NULL,
	"deadline" text,
	"aligned_with_blueprint_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_learning_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pattern_type" text NOT NULL,
	"pattern_description" text NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actionable_insight" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_lesson_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"time_spent_seconds" integer,
	"score" double precision,
	"passed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"lesson_number" integer NOT NULL,
	"title" text NOT NULL,
	"content_type" text DEFAULT 'text' NOT NULL,
	"content_body" text NOT NULL,
	"key_concepts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reading_time_minutes" integer DEFAULT 15 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_practice_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"practice_item_id" uuid NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_answer" text NOT NULL,
	"correct" boolean NOT NULL,
	"time_taken_seconds" integer,
	"is_retry" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_practice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"item_type" text DEFAULT 'quiz' NOT NULL,
	"difficulty" integer DEFAULT 2 NOT NULL,
	"question_text" text NOT NULL,
	"answer_options" jsonb,
	"correct_answer" text NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_proof" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"proof_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reflection" text,
	"validation_status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_retention_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"learned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recalled_correctly" integer DEFAULT 0 NOT NULL,
	"recalled_incorrectly" integer DEFAULT 0 NOT NULL,
	"retention_percent" double precision DEFAULT 0 NOT NULL,
	"forgetting_curve" double precision,
	"next_review_date" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_roadmap_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_goal_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"course_id" uuid,
	"estimated_duration_days" integer DEFAULT 7 NOT NULL,
	"prerequisite_step_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'not-started' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "academy_student_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"status" text DEFAULT 'enrolled' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_student_learning_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_style" text DEFAULT 'reading' NOT NULL,
	"pace" text DEFAULT 'normal' NOT NULL,
	"preferred_formats" jsonb DEFAULT '["text"]'::jsonb NOT NULL,
	"comprehension_speed" double precision DEFAULT 1 NOT NULL,
	"retention_rate" double precision DEFAULT 0.7 NOT NULL,
	"common_mistakes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weaknesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academy_student_learning_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "academy_study_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_goal_id" uuid NOT NULL,
	"schedule_type" text DEFAULT 'weekly' NOT NULL,
	"sessions_per_week" integer DEFAULT 3 NOT NULL,
	"minutes_per_session" integer DEFAULT 45 NOT NULL,
	"start_date" text,
	"end_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_goal_id" uuid,
	"schedule_id" uuid,
	"session_date" text NOT NULL,
	"start_time" text NOT NULL,
	"duration_minutes" integer DEFAULT 45 NOT NULL,
	"synced_to_calendar" boolean DEFAULT false NOT NULL,
	"calendar_block_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"learning_path_id" uuid,
	"knowledge_id" text,
	"title" text NOT NULL,
	"description" text,
	"learning_content" text,
	"trigger_reason" text NOT NULL,
	"domain" text,
	"skill_target" text,
	"skill_category" text,
	"lesson_number" integer,
	"lesson_objective" text,
	"mastery_definition" text,
	"practice_type" text,
	"completion_score" double precision,
	"skill_delta" double precision,
	"proof_required" boolean DEFAULT true NOT NULL,
	"proof_description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"blocks_execution" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"achievement_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"icon_url" text,
	"trigger_condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"rarity" text DEFAULT 'common' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_achievement_id_unique" UNIQUE("achievement_id")
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"target_id" uuid,
	"user_id" uuid,
	"name" text NOT NULL,
	"title" text,
	"description" text,
	"type" "action_type" NOT NULL,
	"action_type" text,
	"expected_output" text,
	"knowledge_category" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"trace_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "active_feedback_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"session_date" date DEFAULT now() NOT NULL,
	"trigger_type" text DEFAULT 'app_open' NOT NULL,
	"daily_reality" jsonb,
	"reality_summary" text,
	"task_states" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emotional_state" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"friction_type" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_type" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reflection_signal" text,
	"engine_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signal_snapshot" jsonb,
	"execution_score" double precision,
	"confidence" double precision,
	"bhudhi_interpretation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_conflict_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_a" text NOT NULL,
	"agent_b" text NOT NULL,
	"trigger_type" text NOT NULL,
	"agent_a_output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"agent_b_output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conflict_type" text NOT NULL,
	"resolution" text NOT NULL,
	"resolved_output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"activation_phase" text DEFAULT 'P1' NOT NULL,
	"trigger_types" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"output_contract" text NOT NULL,
	"last_activated" timestamp with time zone,
	"total_activations" integer DEFAULT 0 NOT NULL,
	"average_latency_ms" double precision,
	"quality_score" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_registry_agent_name_unique" UNIQUE("agent_name")
);
--> statement-breakpoint
CREATE TABLE "avatar_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avatar_name" text NOT NULL,
	"base_asset_url" text,
	"customization_options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evolution_level" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"pattern_id" uuid,
	"order_id" uuid,
	"feedback_id" uuid,
	"event_type" text NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"pattern_type" "behavior_pattern_type" NOT NULL,
	"severity" text,
	"confidence" double precision,
	"frequency" integer DEFAULT 1 NOT NULL,
	"evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "behavior_pattern_status" DEFAULT 'active' NOT NULL,
	"first_detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "behavioral_insight_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"insight_type" text NOT NULL,
	"insight_text" text NOT NULL,
	"evidence_summary" text NOT NULL,
	"action_suggestion" text,
	"trigger_event" text NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"blueprint_id" uuid,
	"order_id" uuid,
	"request_type" "bhudhi_request_type" NOT NULL,
	"trigger_type" "bhudhi_trigger_type",
	"response_type" text,
	"execution_context" "bhudhi_execution_context",
	"input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prompt_version" text,
	"model_used" text,
	"output_json" jsonb,
	"raw_response" text,
	"validation_status" text,
	"validation_notes" text,
	"output_schema_valid" boolean DEFAULT true NOT NULL,
	"authority_language_detected" boolean DEFAULT false NOT NULL,
	"latency_ms" integer,
	"token_count_in" integer,
	"token_count_out" integer,
	"confidence_tier" text,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"output_hash" text,
	"world_state_version" integer,
	"validation_fail_reason" text,
	"web_search_calls" integer,
	"web_search_used" boolean DEFAULT false NOT NULL,
	"search_queries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"intelligence_grounded" boolean,
	"provider" text DEFAULT 'claude',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"memory_type" text NOT NULL,
	"content" text,
	"content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scope" text,
	"source_type" text,
	"source_id" uuid,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"relevance_score" double precision DEFAULT 0.5 NOT NULL,
	"reinforcement_count" integer DEFAULT 1 NOT NULL,
	"last_reinforced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"is_compressed" boolean DEFAULT false NOT NULL,
	"source_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_research_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_hash" text NOT NULL,
	"query_text" text NOT NULL,
	"research_type" text NOT NULL,
	"result_json" jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" text NOT NULL,
	"tokens_used" integer,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "bhudhi_research_cache_query_hash_unique" UNIQUE("query_hash")
);
--> statement-breakpoint
CREATE TABLE "bhudhi_usage_budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date_utc" text NOT NULL,
	"tier" text NOT NULL,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"total_input_tokens" integer DEFAULT 0 NOT NULL,
	"total_output_tokens" integer DEFAULT 0 NOT NULL,
	"total_cost_cents" double precision DEFAULT 0 NOT NULL,
	"calls_by_trigger" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"budget_exhausted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blocker_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"blocker_type" text NOT NULL,
	"severity" integer DEFAULT 3 NOT NULL,
	"description" text NOT NULL,
	"related_order_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"resolution_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_framework_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"signal_key" text NOT NULL,
	"value" double precision DEFAULT 0.5 NOT NULL,
	"previous_value" double precision,
	"momentum" double precision DEFAULT 0 NOT NULL,
	"trend" text DEFAULT 'stable' NOT NULL,
	"confidence" double precision DEFAULT 0.3 NOT NULL,
	"value_history" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_health_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"health_score" double precision NOT NULL,
	"phase_progress_rate" double precision DEFAULT 0 NOT NULL,
	"target_achievement_rate" double precision DEFAULT 0 NOT NULL,
	"action_coverage_rate" double precision DEFAULT 0 NOT NULL,
	"gaps_detected" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dead_actions_count" integer DEFAULT 0 NOT NULL,
	"stagnant_phases_count" integer DEFAULT 0 NOT NULL,
	"weak_targets_count" integer DEFAULT 0 NOT NULL,
	"proposals_generated" integer DEFAULT 0 NOT NULL,
	"agent_assessment" text NOT NULL,
	"confidence_tier" text DEFAULT 'MEDIUM' NOT NULL,
	"world_state_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_interpretations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"interpretation" text NOT NULL,
	"key_insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_focus" text NOT NULL,
	"next_milestone" text NOT NULL,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence_tier" text DEFAULT 'MEDIUM' NOT NULL,
	"world_state_version" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "blueprint_interpretations_blueprint_id_unique" UNIQUE("blueprint_id")
);
--> statement-breakpoint
CREATE TABLE "blueprint_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" DEFAULT 'contributor' NOT NULL,
	"domain" text,
	"invited_by" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_mutations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"mutation_type" text NOT NULL,
	"layer" text NOT NULL,
	"entity_id" uuid,
	"change_summary" text NOT NULL,
	"cascade_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"focus_statement" text,
	"anti_focus" text,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enforcement_level" text DEFAULT 'guidance' NOT NULL,
	"generated_from" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_log_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_tier_migrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"from_tier" "user_tier" NOT NULL,
	"to_tier" "user_tier" NOT NULL,
	"unlocked_systems" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"migration_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"change_type" text NOT NULL,
	"affected_layer" text NOT NULL,
	"before_state" jsonb NOT NULL,
	"after_state" jsonb NOT NULL,
	"framework_source" text,
	"triggered_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"goal" text NOT NULL,
	"raw_goal" text,
	"raw_goal_input" text,
	"goal_options" jsonb,
	"selected_goal_index" integer,
	"raw_purpose" text,
	"raw_purpose_input" text,
	"purpose_options" jsonb,
	"selected_purpose_index" integer,
	"goal_final" text,
	"purpose_final" text,
	"project_name" text,
	"refinement_status" text DEFAULT 'pending',
	"economic_type" text,
	"purpose" text,
	"current_context" text,
	"success_signal" text,
	"known_blockers" text,
	"timeframe_days" integer,
	"timeframe_start" timestamp with time zone,
	"timeframe_end" timestamp with time zone,
	"role_context" text,
	"domain_hint" text,
	"domain" text,
	"location" jsonb,
	"business_model" text,
	"online_offline" text,
	"budget" double precision,
	"current_resources" jsonb,
	"target_customers" text,
	"target_profit" double precision,
	"selected_path" text,
	"selected_blueprint_level" text,
	"validation_verdict" text,
	"validation_scores" jsonb,
	"validation_report" jsonb,
	"path_options" jsonb,
	"blueprint_options" jsonb,
	"commitment_level" "commitment_level",
	"mode" "user_mode" DEFAULT 'individual' NOT NULL,
	"tier" "user_tier",
	"intelligence_depth" "intelligence_depth",
	"selection_confirmed_at" timestamp with time zone,
	"blueprint_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"operational_state" "blueprint_operational_state" DEFAULT 'ACTIVE',
	"current_domain" "domain",
	"status" "blueprint_status" DEFAULT 'draft' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"current_condition" "condition",
	"current_plan_id" uuid,
	"current_phase_id" uuid,
	"current_project_id" uuid,
	"current_action_id" uuid,
	"validation_id" uuid,
	"erector_validation_id" uuid,
	"primary_archetype_id" uuid,
	"reality_score" double precision,
	"blueprint_tier" text,
	"industry_state" text,
	"archetype_execution_mult" double precision,
	"archetype_timeframe_mult" double precision,
	"archetype_difficulty_adj" double precision,
	"chosen_blueprint_level" text,
	"economy_briefing_summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"paused_at" timestamp with time zone,
	"pause_reason" text,
	"completed_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"intel_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current_sequence_number" integer DEFAULT 1 NOT NULL,
	"sequences_completed_numbers" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"tier_sequence_gates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sequence_audit_log" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"last_sequence_update" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "burnout_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"risk_level" text NOT NULL,
	"risk_score" double precision NOT NULL,
	"evidence_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completion_rate_drop" double precision,
	"score_divergence" double precision,
	"reflection_quality_drop" double precision,
	"consecutive_declines" integer,
	"session_frequency_drop" double precision,
	"recommendation" text NOT NULL,
	"action_taken" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_1_id" uuid NOT NULL,
	"event_2_id" uuid NOT NULL,
	"conflict_type" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source_id" uuid,
	"source_type" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"location" text,
	"location_coordinates" jsonb,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"notification_type" text DEFAULT 'in-app' NOT NULL,
	"trigger_minutes_before" integer NOT NULL,
	"scheduled_send_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"block_type" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"recurrence_pattern" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_views_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"default_view" text DEFAULT 'calendar' NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"color_coding" text DEFAULT 'by-type' NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"week_start_day" integer DEFAULT 1 NOT NULL,
	"show_weekends" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_views_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "capability_gap_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"order_id" uuid,
	"gap_type" text NOT NULL,
	"detected_from" text DEFAULT 'FAILURE_CLASSIFICATION' NOT NULL,
	"severity" text DEFAULT 'MEDIUM' NOT NULL,
	"learning_path_id" uuid,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capability_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"trigger_event" text,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capability_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"level" "capability_level" DEFAULT 'beginner' NOT NULL,
	"current_level" text DEFAULT 'beginner' NOT NULL,
	"consistency_score" double precision DEFAULT 0 NOT NULL,
	"execution_quality" double precision DEFAULT 0 NOT NULL,
	"throughput" "throughput" DEFAULT 'low' NOT NULL,
	"recovery_rate" double precision DEFAULT 0 NOT NULL,
	"fatigue_risk" "fatigue_risk" DEFAULT 'low' NOT NULL,
	"current_difficulty" "difficulty" DEFAULT 'easy' NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"tasks_failed" integer DEFAULT 0 NOT NULL,
	"streak_current" integer DEFAULT 0 NOT NULL,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"streak_best" integer DEFAULT 0 NOT NULL,
	"identity_type" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capability_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "channel_notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_type" text NOT NULL,
	"notification_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"delivery_time_window_start" text,
	"delivery_time_window_end" text,
	"batch_frequency" text DEFAULT 'immediate' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_progression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consistency" double precision DEFAULT 0 NOT NULL,
	"grit" double precision DEFAULT 0 NOT NULL,
	"discipline" double precision DEFAULT 0 NOT NULL,
	"execution_intelligence" double precision DEFAULT 0 NOT NULL,
	"adaptability" double precision DEFAULT 0 NOT NULL,
	"overall_character_score" double precision DEFAULT 0 NOT NULL,
	"character_level" integer DEFAULT 1 NOT NULL,
	"trait_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_progression_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_voice_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"audio_file_url" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"transcription" text,
	"transcription_confidence" double precision,
	"transcribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cognitive_load_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"load_score" double precision NOT NULL,
	"active_tasks" integer NOT NULL,
	"choice_count" integer,
	"decision_latency_ms" integer,
	"reversal_count" integer,
	"ambiguity_flags" integer,
	"load_category" text,
	"complexity_level" text,
	"recommendation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_intelligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"niche" text,
	"competitors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"activity_window" text DEFAULT '24h' NOT NULL,
	"key_findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"threat_level" text DEFAULT 'LOW' NOT NULL,
	"opportunity_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"research_method" text DEFAULT 'FALLBACK' NOT NULL,
	"confidence_tier" text DEFAULT 'LOW' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "condition_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"condition" "condition" DEFAULT 'nothingness' NOT NULL,
	"previous_condition" "condition",
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"duration_days" double precision DEFAULT 0 NOT NULL,
	"recovery_required" boolean DEFAULT false NOT NULL,
	"transitioned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"condition" "condition" NOT NULL,
	"signal_snapshot_id" uuid,
	"duration_days" integer DEFAULT 0 NOT NULL,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"recovery_required" boolean DEFAULT false NOT NULL,
	"reason" text,
	"source" text,
	"transition_reason" text,
	"previous_condition" "condition",
	"is_current" boolean DEFAULT true NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_guidance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"principle_id" uuid NOT NULL,
	"guidance_date" text NOT NULL,
	"recommended_platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_format" text NOT NULL,
	"content_angle" text NOT NULL,
	"trending_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"platform_trends" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"research_prompts" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "continuous_task_guarantee_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"trigger_reason" text NOT NULL,
	"blocker_type" text NOT NULL,
	"task_type_generated" text NOT NULL,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contradiction_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"contradiction_type" text NOT NULL,
	"description" text NOT NULL,
	"elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "critic_review_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bhudhi_log_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reviewing_agent" text DEFAULT 'CRITIC' NOT NULL,
	"input_agent" text NOT NULL,
	"verdict" text NOT NULL,
	"confidence_score" double precision DEFAULT 0.5 NOT NULL,
	"confidence_tier" text DEFAULT 'MEDIUM' NOT NULL,
	"rejection_reason" text,
	"flag_reason" text,
	"governance_violation" boolean DEFAULT false NOT NULL,
	"violation_detail" text,
	"revised_output" jsonb,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_principle_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"principle_date" text NOT NULL,
	"principle_id" uuid NOT NULL,
	"application_id" uuid,
	"published_content_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"engagement_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"public_visible" boolean DEFAULT true NOT NULL,
	"reflection" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_intelligence_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"strategic_outlook" jsonb,
	"behavioral_insight" jsonb,
	"blueprint_health" jsonb,
	"signal_narrative" jsonb,
	"execution_brief" jsonb,
	"governance_summary" jsonb,
	"last_refreshed" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot_version" integer DEFAULT 1 NOT NULL,
	"world_state_version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dashboard_intelligence_snapshots_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "dead_letter_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"blueprint_id" uuid,
	"user_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failure_reason" text NOT NULL,
	"failure_class" text DEFAULT 'transient' NOT NULL,
	"retry_count" integer NOT NULL,
	"last_error" text,
	"resolution_status" text DEFAULT 'OPEN' NOT NULL,
	"requires_manual" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"reviewed_at" timestamp with time zone,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "debate_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trigger_type" text NOT NULL,
	"debate_topic" text NOT NULL,
	"rounds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"consensus_reached" boolean DEFAULT false NOT NULL,
	"final_verdict" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"judge_rationale" text DEFAULT '' NOT NULL,
	"debate_duration_ms" integer DEFAULT 0 NOT NULL,
	"agents_involved" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"blueprint_id" uuid NOT NULL,
	"decision_type" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"reasoning" text NOT NULL,
	"input_summary" text,
	"output_summary" text,
	"alternatives_considered" jsonb DEFAULT '[]'::jsonb,
	"state_version" integer,
	"inputs_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"outputs_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"engine" text,
	"engine_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "do_not_disturb_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_time" text DEFAULT '22:00' NOT NULL,
	"end_time" text DEFAULT '07:00' NOT NULL,
	"days_of_week" jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "do_not_disturb_schedules_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "domain_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" "domain" NOT NULL,
	"previous_domain" "domain",
	"transition_trigger" "domain_transition_trigger" NOT NULL,
	"trigger_event_id" uuid,
	"transition_notes" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "economic_archetypes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archetype_number" integer NOT NULL,
	"name" text NOT NULL,
	"countries" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"institutional_strength" double precision NOT NULL,
	"corruption_index" double precision NOT NULL,
	"infrastructure_quality" double precision NOT NULL,
	"digital_adoption" double precision NOT NULL,
	"consumer_purchasing_power" double precision NOT NULL,
	"startup_ecosystem_maturity" double precision NOT NULL,
	"regulatory_openness" double precision NOT NULL,
	"political_stability" double precision NOT NULL,
	"labor_market_flexibility" double precision NOT NULL,
	"market_competition_density" double precision NOT NULL,
	"consumer_behavior_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"typical_resistance_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"survivor_behavior_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cultural_business_norms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"primary_risk_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"primary_opportunity_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeframe_pressure_multiplier" double precision DEFAULT 1 NOT NULL,
	"execution_intensity_multiplier" double precision DEFAULT 1 NOT NULL,
	"blueprint_difficulty_adjustment" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "economic_archetypes_archetype_number_unique" UNIQUE("archetype_number")
);
--> statement-breakpoint
CREATE TABLE "eis_call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"validation_id" uuid,
	"industry" text,
	"niche" text,
	"tokens_used" integer,
	"estimated_cost_usd" double precision,
	"model_used" text,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"low_confidence" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eis_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"industry" text NOT NULL,
	"niche" text NOT NULL,
	"last_call_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cached_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enforcement_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid,
	"condition_id" uuid,
	"signal_snapshot_id" uuid,
	"condition" "condition" NOT NULL,
	"task_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"difficulty_cap" "difficulty" DEFAULT 'moderate' NOT NULL,
	"allowed_actions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"blocked_actions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"restricted_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phase_permission" "phase_permission",
	"target_adjustment" "target_adjustment",
	"ai_mode" "ai_mode",
	"ui_mode" "ui_mode",
	"feature_permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risk_level" "risk_level",
	"override_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cognitive_load_score" double precision,
	"recovery_required" boolean DEFAULT false NOT NULL,
	"progression_allowed" boolean DEFAULT true NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"condition" text NOT NULL,
	"trigger_reason" text NOT NULL,
	"action_taken" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"worker" text,
	"result" "event_log_result",
	"error_code" text,
	"error_message" text,
	"duration_ms" integer,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"user_id" uuid,
	"blueprint_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text,
	"status" "event_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"process_after" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "execution_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"session_type" text DEFAULT 'PRIMARY' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"tasks_generated" integer DEFAULT 0 NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"feedback_cycles" integer DEFAULT 0 NOT NULL,
	"signal_updates" integer DEFAULT 0 NOT NULL,
	"session_health" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_intelligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"goal_summary" text,
	"market_trends" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opportunity_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"competitor_moves" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"execution_recommendation" text,
	"confidence" text DEFAULT 'LOW' NOT NULL,
	"source_type" text DEFAULT 'BHUDHI_KNOWLEDGE' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"source_type" text NOT NULL,
	"source_name" text NOT NULL,
	"trust_level" text DEFAULT 'UNTRUSTED' NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"signal_type" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"normalized_payload" jsonb,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "failure_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"feedback_id" uuid NOT NULL,
	"primary_candidate" text NOT NULL,
	"primary_likelihood" double precision NOT NULL,
	"secondary_candidate" text,
	"secondary_likelihood" double precision,
	"tertiary_candidate" text,
	"tertiary_likelihood" double precision,
	"evidence_citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"system_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fallback_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_type" text NOT NULL,
	"prompt_name" text NOT NULL,
	"reason" text NOT NULL,
	"fallback_type" text DEFAULT 'DETERMINISTIC_TEMPLATE' NOT NULL,
	"user_id" uuid,
	"bhudhi_log_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "false_progress_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"detection_type" text NOT NULL,
	"evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"severity" text,
	"status" text DEFAULT 'active' NOT NULL,
	"resolution_task_id" uuid,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"environment" text,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_feature_name_unique" UNIQUE("feature_name")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"completion_status" text NOT NULL,
	"score" integer,
	"confidence_weight" double precision,
	"weighted_score" double precision,
	"reflection" text,
	"friction_score" double precision,
	"confidence_score" double precision,
	"duration_minutes" integer,
	"proof_json" jsonb,
	"blocker_json" jsonb,
	"interrogation_json" jsonb,
	"gaming_flag" boolean DEFAULT false NOT NULL,
	"gaming_reason" text,
	"late_penalty_applied" boolean DEFAULT false NOT NULL,
	"failure_classification" text,
	"failure_correction_type" text,
	"difficulty_felt" text,
	"submitted_hours_after_completion" double precision,
	"validity" text DEFAULT 'valid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "framework_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"signal_snapshot_id" uuid,
	"framework_name" "framework_name" NOT NULL,
	"activation_level" "framework_activation_level",
	"confidence" double precision,
	"reason" text,
	"trigger_condition" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "framework_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activation_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"decision_type" text NOT NULL,
	"target_layer" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requires_control_engine" boolean DEFAULT true NOT NULL,
	"status" "framework_decision_status" DEFAULT 'proposed' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "framework_signal_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"signal_snapshot_id" uuid,
	"framework_name" "framework_name" NOT NULL,
	"signal_state" text NOT NULL,
	"score" double precision,
	"confidence" double precision,
	"evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"proposal_type" text NOT NULL,
	"proposing_agent" text DEFAULT 'BLUEPRINT' NOT NULL,
	"proposal_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rationale" text NOT NULL,
	"evidence_citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"impact_assessment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"expires_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"approval_note" text,
	"world_state_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"order_id" uuid,
	"completed" boolean NOT NULL,
	"effort_score" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"frequency" text,
	"time_of_day" text,
	"active" boolean DEFAULT true NOT NULL,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"event_id" uuid,
	"result" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_records_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "identity_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"trigger" text,
	"stage_before" text,
	"stage_after" text,
	"transformation_score" double precision,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"self_image" text,
	"identity_stage" text DEFAULT 'FORMING' NOT NULL,
	"confidence_score" double precision DEFAULT 0.5 NOT NULL,
	"confidence_trend" text DEFAULT 'STABLE' NOT NULL,
	"purpose_alignment" double precision DEFAULT 0.5 NOT NULL,
	"primary_identity" text,
	"aspirational_identity" text,
	"execution_identity" text,
	"active_conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conflict_count" integer DEFAULT 0 NOT NULL,
	"milestones_reached" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_milestone_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "in_app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"notification_type" text NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inactivity_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL,
	"inactivity_hours" double precision NOT NULL,
	"inactivity_days" double precision NOT NULL,
	"inactivity_type" text,
	"severity" text,
	"last_feedback_at" timestamp with time zone,
	"threshold_breached" "inactivity_threshold" NOT NULL,
	"response_triggered" text,
	"response_event_id" uuid,
	"recovery_task_id" uuid,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"blueprint_id" uuid,
	"user_id" uuid,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"type" text NOT NULL,
	"domain" "domain",
	"action_type" text,
	"applicable_level" text,
	"is_global" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"action_type" text NOT NULL,
	"phase" text,
	"sop" text,
	"benchmark" text,
	"tool_recommendations" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"common_mistakes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"good_output_example" text,
	"execution_guidance" text,
	"eis_enriched" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"skill_gap" text NOT NULL,
	"domain" text NOT NULL,
	"path_status" text DEFAULT 'ACTIVE' NOT NULL,
	"lessons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_lessons" integer DEFAULT 0 NOT NULL,
	"completed_lessons" integer DEFAULT 0 NOT NULL,
	"mastery_score" double precision,
	"mastery_evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "level_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" integer NOT NULL,
	"xp_required_total" integer NOT NULL,
	"milestone_title" text,
	"milestone_description" text,
	"avatar_evolution_unlocked" boolean DEFAULT false NOT NULL,
	"new_cosmetics_available" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_definitions_level_unique" UNIQUE("level")
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_link_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text,
	"file_size" integer,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_search_index" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"searchable_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_cognition_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text NOT NULL,
	"domain_reliability" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prediction_accuracy" double precision DEFAULT 0.5 NOT NULL,
	"total_predictions" integer DEFAULT 0 NOT NULL,
	"correct_predictions" integer DEFAULT 0 NOT NULL,
	"hallucination_risk" double precision DEFAULT 0.2 NOT NULL,
	"strong_domains" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"weak_domains" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"last_calibration_update" timestamp with time zone DEFAULT now() NOT NULL,
	"calibration_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_cognition_profiles_agent_name_unique" UNIQUE("agent_name")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"type" "milestone_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"value" double precision,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seen_by_user" boolean DEFAULT false NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"push_token" text NOT NULL,
	"platform" text NOT NULL,
	"device_id" text,
	"app_version" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_health_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric_date" text NOT NULL,
	"steps" integer,
	"active_minutes" integer,
	"calories_burned" integer,
	"heart_rate_avg" integer,
	"sleep_hours" double precision,
	"source" text DEFAULT 'apple-health' NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_action_id" text NOT NULL,
	"resource" text NOT NULL,
	"action_type" text NOT NULL,
	"status" text DEFAULT 'applied' NOT NULL,
	"error_message" text,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mobile_wearable_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"oauth_token_encrypted" text,
	"is_connected" boolean DEFAULT false NOT NULL,
	"connected_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "morning_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"report_date" text NOT NULL,
	"eis_section" jsonb,
	"signal_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"next_task_preview" jsonb,
	"report_body" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "narrative_intelligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"niche" text,
	"dominant_narrative" text NOT NULL,
	"emerging_narratives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sentiment_signal" text DEFAULT 'NEUTRAL' NOT NULL,
	"audience_emotions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_angle" text NOT NULL,
	"risk_narratives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"research_method" text DEFAULT 'FALLBACK' NOT NULL,
	"confidence_tier" text DEFAULT 'LOW' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"queue_id" uuid,
	"channel_type" text NOT NULL,
	"status" text NOT NULL,
	"delivery_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"notification_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"channels_to_send" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_for" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"notification_type" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"suppression_reason" text,
	"source_event_id" text,
	"idempotency_key" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"payload_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_logs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "order_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"blocking_order_id" uuid NOT NULL,
	"blocked_order_id" uuid NOT NULL,
	"dependency_type" text DEFAULT 'SEQUENTIAL' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_knowledge_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"knowledge_id" text NOT NULL,
	"injection_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action_id" uuid,
	"plan_id" uuid,
	"phase_id" uuid,
	"project_id" uuid,
	"linked_plan_id" uuid,
	"linked_season_id" uuid,
	"linked_target_id" uuid,
	"linked_phase_id" uuid,
	"linked_project_id" uuid,
	"enforcement_package_id" uuid,
	"task_type" "task_type" NOT NULL,
	"title" text NOT NULL,
	"instruction" text NOT NULL,
	"expected_output" text NOT NULL,
	"definition_of_done" text NOT NULL,
	"context_why" text,
	"order_type" text,
	"why_it_matters" text,
	"time_estimate_minutes" integer,
	"time_estimate_mins" integer,
	"content_hash" text,
	"knowledge_links" jsonb,
	"command_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proof_required" boolean DEFAULT false NOT NULL,
	"proof_type" "proof_type",
	"proof_description" text,
	"difficulty" "difficulty" DEFAULT 'moderate' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"domain" "domain",
	"value_score" double precision,
	"condition_at_generation" text,
	"domain_at_generation" text,
	"generation_reason" text,
	"assigned_member_id" uuid,
	"trace_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"blocker_type" text,
	"blocker_description" text,
	"dependency_reference" text,
	"output_summary" text,
	"proof_json" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"task_state" text,
	"carry_over" boolean DEFAULT false NOT NULL,
	"last_feedback_at" timestamp with time zone,
	"is_visible" boolean DEFAULT true NOT NULL,
	"visibility_date" timestamp with time zone,
	"mini_plan_key" text,
	"created_from_condition" text,
	"due_at" timestamp with time zone,
	"due_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome_validation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"feedback_id" uuid NOT NULL,
	"proof_quality_score" double precision DEFAULT 0 NOT NULL,
	"proof_type" text,
	"missing_criteria" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"false_progress_risk" text DEFAULT 'NONE' NOT NULL,
	"false_progress_score" double precision DEFAULT 0 NOT NULL,
	"divergence_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"validation_verdict" text NOT NULL,
	"proof_requirement_adjusted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"target_id" uuid,
	"real_outcome_id" uuid,
	"validation_result" text,
	"evidence_score" double precision,
	"evidence_summary" text,
	"validator_source" text DEFAULT 'SYSTEM',
	"validated_at" timestamp with time zone,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"outcomes_verified" integer DEFAULT 0 NOT NULL,
	"alignment_score" double precision DEFAULT 0 NOT NULL,
	"verdict" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pattern_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pattern_type" text NOT NULL,
	"description" text NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"first_detected" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"actionable" boolean DEFAULT false NOT NULL,
	"recommendation" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"content" text,
	"voice_url" text,
	"voice_duration_seconds" integer,
	"voice_transcription" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"linked_order_id" uuid,
	"linked_principle_id" uuid,
	"sentiment" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_blocker" boolean DEFAULT false NOT NULL,
	"blocker_type" text,
	"blocker_severity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"phase_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"outcomes_achieved" text,
	"evidence_summary" text,
	"bottlenecks" text,
	"next_risks" text,
	"proof_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"readiness" text,
	"system_verdict" text,
	"rejection_reason" text,
	"evaluated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"target_id" uuid,
	"plan_id" uuid,
	"user_id" uuid,
	"name" "phase_name" NOT NULL,
	"title" text,
	"description" text,
	"order_index" integer NOT NULL,
	"gate_criteria" jsonb,
	"unlock_criteria" jsonb,
	"status" "phase_status" DEFAULT 'pending' NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"progress_percent" double precision DEFAULT 0 NOT NULL,
	"gate_passed" boolean DEFAULT false NOT NULL,
	"trace_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pivot_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_reason" text NOT NULL,
	"signal_snapshot_id" uuid,
	"condition_at_trigger" text,
	"path_options_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"selected_path" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"title" text,
	"description" text,
	"purpose" text,
	"outcome" text,
	"order_index" integer NOT NULL,
	"status" "plan_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_algorithm_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"signal_type" text DEFAULT 'UNKNOWN' NOT NULL,
	"content_category" text NOT NULL,
	"signal_strength" double precision DEFAULT 0.5 NOT NULL,
	"confidence_tier" text DEFAULT 'LOW' NOT NULL,
	"source_evidence" text NOT NULL,
	"recommendation" text NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"agent_name" text NOT NULL,
	"prediction_type" text NOT NULL,
	"prediction" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_level" double precision DEFAULT 0.5 NOT NULL,
	"confidence_tier" text DEFAULT 'MEDIUM' NOT NULL,
	"predicted_outcome" jsonb,
	"actual_outcome" jsonb,
	"accuracy_score" double precision,
	"verification_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"dropout_risk" double precision DEFAULT 0 NOT NULL,
	"burnout_risk" double precision DEFAULT 0 NOT NULL,
	"plateau_risk" double precision DEFAULT 0 NOT NULL,
	"scaling_readiness" double precision DEFAULT 0 NOT NULL,
	"confidence" text DEFAULT 'LOW' NOT NULL,
	"primary_risk" text,
	"primary_opportunity" text,
	"recommended_action" text DEFAULT 'MAINTAIN' NOT NULL,
	"signal_snapshot_id" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "principle_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"principle_id" uuid NOT NULL,
	"principle_date" text NOT NULL,
	"proof_type" text NOT NULL,
	"proof_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"application_description" text NOT NULL,
	"linked_order_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_visible" boolean DEFAULT true NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "principle_proof_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"file_url" text,
	"file_type" text,
	"file_size" integer,
	"duration_seconds" integer,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "principle_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"principle_id" uuid NOT NULL,
	"selected_date" text NOT NULL,
	"selection_reason" text NOT NULL,
	"signal_state" text,
	"execution_blocker" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "principle_streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"last_applied_date" text,
	"streak_frozen_month" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "principle_streaks_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "principles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_number" integer NOT NULL,
	"principle_statement" text NOT NULL,
	"principle_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"philosophy" text NOT NULL,
	"tension_points" text NOT NULL,
	"management_volume_source" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "principles_day_number_unique" UNIQUE("day_number")
);
--> statement-breakpoint
CREATE TABLE "project_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"blocking_project_id" uuid NOT NULL,
	"blocked_project_id" uuid NOT NULL,
	"dependency_type" text DEFAULT 'SEQUENTIAL' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"phase_id" uuid,
	"target_id" uuid,
	"user_id" uuid,
	"owner_id" uuid,
	"assignee_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"trace_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"description" text,
	"type" "project_type" NOT NULL,
	"project_type" text,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"blocked_reason" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"status" "project_status" DEFAULT 'pending' NOT NULL,
	"progress_percent" double precision DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"principle_id" uuid,
	"content_date" text NOT NULL,
	"platforms_posted" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_text" text NOT NULL,
	"content_url" text,
	"engagement" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_engagement_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "real_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"target_id" uuid,
	"outcome_type" text,
	"claimed_value" text,
	"evidence_text" text,
	"proof_json" jsonb DEFAULT '{}'::jsonb,
	"validation_status" text DEFAULT 'pending' NOT NULL,
	"metric_name" text NOT NULL,
	"metric_value" double precision NOT NULL,
	"unit" text,
	"source" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"milestone_id" uuid,
	"idempotency_key" text NOT NULL,
	"reward_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"ui_action" text,
	"delivered" boolean DEFAULT false NOT NULL,
	"delivered_at" timestamp with time zone,
	"message" text,
	"evidence_summary" text,
	"reward_level" text DEFAULT 'MINOR',
	"source_event_id" uuid,
	"intensity" text,
	"seen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reward_id" text NOT NULL,
	"reward_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"unlock_requirement" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rewards_reward_id_unique" UNIQUE("reward_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"plan_id" uuid,
	"name" "season_name" DEFAULT 'ignition' NOT NULL,
	"order_index" integer NOT NULL,
	"effort_level" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"status" "plan_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"token" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "signal_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"week_start" timestamp with time zone,
	"window_end" timestamp with time zone NOT NULL,
	"completion_rate" double precision NOT NULL,
	"weighted_score" double precision NOT NULL,
	"daily_score" double precision DEFAULT 0 NOT NULL,
	"momentum" integer NOT NULL,
	"trend" "signal_trend" DEFAULT 'stable' NOT NULL,
	"confidence" "signal_confidence" DEFAULT 'insufficient_data' NOT NULL,
	"blocker_ratio" double precision DEFAULT 0 NOT NULL,
	"skip_ratio" double precision DEFAULT 0 NOT NULL,
	"consistency" double precision DEFAULT 0 NOT NULL,
	"velocity" double precision DEFAULT 0 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"window_days" integer DEFAULT 7 NOT NULL,
	"data_points" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"operational_mathematics_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"execution_score" double precision,
	"feedback_confidence" double precision,
	"assigned_condition" "condition",
	"condition" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"causation_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" text DEFAULT 'Content' NOT NULL,
	"skill_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"detected_gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mastered_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_assessment" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "stability_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'MEDIUM' NOT NULL,
	"description" text NOT NULL,
	"agent_involved" text,
	"trigger_type" text,
	"resolution" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"condition" text NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"current_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_event" text,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exited_at" timestamp with time zone,
	"duration_days" integer DEFAULT 0 NOT NULL,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"energy" integer NOT NULL,
	"clarity" integer NOT NULL,
	"momentum" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategic_assumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"validation_id" uuid,
	"assumption_text" text NOT NULL,
	"industry_context" text,
	"monitoring_status" text DEFAULT 'active' NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategic_outlook_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"execution_forecast" text NOT NULL,
	"risk_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opportunity_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"highest_leverage_action" text NOT NULL,
	"condition_prediction" text NOT NULL,
	"momentum_trajectory" text DEFAULT 'STABLE' NOT NULL,
	"confidence_tier" text DEFAULT 'LOW' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_health_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area" text,
	"severity" text,
	"blueprint_id" uuid,
	"user_id" uuid,
	"entity_type" text,
	"entity_id" text,
	"check_type" text NOT NULL,
	"message" text,
	"status" text NOT NULL,
	"score" double precision,
	"details_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"issues_detected" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_health_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"health_score" double precision NOT NULL,
	"signal_engine_health" double precision DEFAULT 1 NOT NULL,
	"condition_engine_health" double precision DEFAULT 1 NOT NULL,
	"bhudhi_health" double precision DEFAULT 1 NOT NULL,
	"db_health" double precision DEFAULT 1 NOT NULL,
	"worker_health" double precision DEFAULT 1 NOT NULL,
	"eis_health" double precision DEFAULT 1 NOT NULL,
	"critical_alerts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dlq_size" integer DEFAULT 0 NOT NULL,
	"pending_events" integer DEFAULT 0 NOT NULL,
	"stale_users" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"plan_id" uuid,
	"season_id" uuid,
	"user_id" uuid,
	"owner_id" uuid,
	"contributor_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"role_domain" text,
	"trace_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"description" text,
	"type" "target_type" NOT NULL,
	"target_type" text,
	"metric" text,
	"metric_name" text,
	"target_value" double precision,
	"current_value" double precision DEFAULT 0 NOT NULL,
	"unit" text,
	"progress" double precision DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"status" "target_status" DEFAULT 'pending' NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_generation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"generation_trigger" "generation_trigger" NOT NULL,
	"generation_mode" "generation_mode" NOT NULL,
	"condition_at_generation" text NOT NULL,
	"enforcement_package_id" uuid,
	"capability_level" text,
	"domain_at_generation" text,
	"input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"orders_generated" integer DEFAULT 0 NOT NULL,
	"order_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"generation_notes" text,
	"used_fallback" boolean DEFAULT false NOT NULL,
	"fallback_reason" text,
	"ai_log_id" uuid,
	"ai_used" boolean DEFAULT false NOT NULL,
	"knowledge_injected" boolean DEFAULT false NOT NULL,
	"knowledge_package_id" uuid,
	"debate_used" boolean DEFAULT false NOT NULL,
	"generation_ms" integer,
	"control_rule_applied" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_generation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"generation_mode" text NOT NULL,
	"generation_trigger" text,
	"task_type" text,
	"difficulty" text,
	"bhudhi_used" boolean DEFAULT false NOT NULL,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"result" text DEFAULT 'success' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trend_intelligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"niche" text,
	"trends" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"velocity_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emerging_trends" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"peaking_trends" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"declining_trends" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opportunity_windows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"research_method" text DEFAULT 'FALLBACK' NOT NULL,
	"confidence_tier" text DEFAULT 'LOW' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_on_profile" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_avatar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_avatar_template_id" uuid,
	"color" text DEFAULT 'violet' NOT NULL,
	"accessories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pose" text DEFAULT 'standing' NOT NULL,
	"customized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_avatar_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_gamification_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_level" integer DEFAULT 1 NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"xp_to_next_level" integer DEFAULT 100 NOT NULL,
	"avatar_id" uuid,
	"avatar_customization" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_achievements" integer DEFAULT 0 NOT NULL,
	"total_rewards_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_gamification_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_identity_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"current_identity" text,
	"target_identity" text,
	"identity_gap_score" double precision DEFAULT 0 NOT NULL,
	"stage" "identity_stage" DEFAULT 'starting' NOT NULL,
	"reinforcement_count" integer DEFAULT 0 NOT NULL,
	"last_reinforced_at" timestamp with time zone,
	"transformation_score" double precision DEFAULT 0 NOT NULL,
	"stability_score" double precision DEFAULT 0 NOT NULL,
	"continuity_score" double precision DEFAULT 0 NOT NULL,
	"regression_risk" text DEFAULT 'LOW' NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"last_evidence_at" timestamp with time zone,
	"previous_stage" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level_number" integer NOT NULL,
	"xp_required_total" integer NOT NULL,
	"milestone_description" text,
	"reached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_type" text NOT NULL,
	"is_connected" boolean DEFAULT false NOT NULL,
	"oauth_token_encrypted" text,
	"oauth_refresh_token_encrypted" text,
	"channel_identifier" text,
	"connected_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_principle_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"username" text NOT NULL,
	"bio" text,
	"profile_public" boolean DEFAULT false NOT NULL,
	"profile_url_slug" text NOT NULL,
	"privacy_setting" text DEFAULT 'private' NOT NULL,
	"show_execution_level" boolean DEFAULT true NOT NULL,
	"show_avatar" boolean DEFAULT true NOT NULL,
	"show_achievements" boolean DEFAULT true NOT NULL,
	"show_principle_record" boolean DEFAULT true NOT NULL,
	"show_streak" boolean DEFAULT true NOT NULL,
	"show_activity" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_principle_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_principle_profiles_username_unique" UNIQUE("username"),
	CONSTRAINT "user_principle_profiles_profile_url_slug_unique" UNIQUE("profile_url_slug")
);
--> statement-breakpoint
CREATE TABLE "user_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_on_profile" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"account_id" text,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"streak_type" text NOT NULL,
	"current_count" integer DEFAULT 0 NOT NULL,
	"best_count" integer DEFAULT 0 NOT NULL,
	"last_activity_date" text,
	"frozen_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"display_name" text,
	"mode" "user_mode" DEFAULT 'individual' NOT NULL,
	"tier" "user_tier" DEFAULT 'starter' NOT NULL,
	"role_context" text,
	"domain_hint" text,
	"commitment_level" "commitment_level",
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"execution_state" text DEFAULT 'NORMAL' NOT NULL,
	"first_login_after_upgrade" boolean DEFAULT false NOT NULL,
	"active_blueprint_id" uuid,
	"civilization_context" jsonb,
	"communication_profile" jsonb,
	"metadata" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"notification_preferences" jsonb DEFAULT '{"email_inactivity_reminder":true,"email_milestone_achieved":true,"email_blueprint_completed":true,"email_pivot_review_ready":true,"email_blueprint_paused":true,"email_weekly_summary":false,"email_all_disabled":false,"quiet_hours_enabled":false,"quiet_hours_start":"22:00","quiet_hours_end":"08:00"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "validation_archetype_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"validation_id" uuid NOT NULL,
	"archetype_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_event_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"validation_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"confidence" integer,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"validation_id" uuid,
	"goal_hash" text NOT NULL,
	"raw_goal_snapshot" text,
	"verdict" text,
	"clarity_score" double precision,
	"feasibility_score" double precision,
	"realism_score" double precision,
	"industry_label" text,
	"selected_path" text,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"raw_goal" text,
	"raw_purpose" text,
	"goal_options" jsonb,
	"goal_understanding" jsonb,
	"selected_goal_option" integer,
	"goal_final" text,
	"purpose_options" jsonb,
	"purpose_understanding" jsonb,
	"selected_purpose_option" integer,
	"purpose_final" text,
	"refinement_locked" boolean DEFAULT false NOT NULL,
	"validation_feed" jsonb,
	"validation_sections" jsonb,
	"validation_final" jsonb,
	"validation_workspace_version" integer DEFAULT 0 NOT NULL,
	"validation_original_snapshot" jsonb,
	"economic_type" text,
	"country" text,
	"timeframe_start" timestamp with time zone,
	"timeframe_end" timestamp with time zone,
	"stage_purpose_decomposition" jsonb,
	"stage_economic_resolution" jsonb,
	"stage_business_patterns" jsonb,
	"stage_economy_timing" jsonb,
	"stage_market_analysis" jsonb,
	"stage_social_channels" jsonb,
	"stage_pros" jsonb,
	"stage_cons" jsonb,
	"stage_feasibility" jsonb,
	"stage_viability" jsonb,
	"stage_bootstrap" jsonb,
	"stage_features" jsonb,
	"stage_customer_definition" jsonb,
	"stage_positioning" jsonb,
	"stage_difficulty" jsonb,
	"stage_revenue_path" jsonb,
	"stage_first_90_days" jsonb,
	"stage_execution_paths" jsonb,
	"stage_final_decision" text,
	"validation_version" integer DEFAULT 1,
	"validation_history" jsonb,
	"user_edits" jsonb,
	"pending_changes" jsonb,
	"is_finalized" boolean DEFAULT false,
	"finalized_at" timestamp with time zone,
	"path_foundation" jsonb,
	"path_momentum" jsonb,
	"path_overdrive" jsonb,
	"selected_execution_path" text,
	"handoff_package" jsonb,
	"purpose" text,
	"timeframe" text,
	"timeframe_days" integer,
	"domain" text,
	"current_context" text,
	"success_signal" text,
	"location_context" text,
	"reality_context" text,
	"selected_blueprint_tier" "user_tier" DEFAULT 'starter',
	"selected_blueprint_mode" "user_mode" DEFAULT 'individual',
	"verdict" "validation_verdict",
	"overall_score" integer,
	"scores" jsonb,
	"key_insights" jsonb,
	"potential_risks" jsonb,
	"path_options" jsonb,
	"recommendation" text,
	"intelligence" jsonb,
	"ai_summary" text,
	"feasibility_score" double precision,
	"clarity_score" double precision,
	"realism_score" double precision,
	"path_current" jsonb,
	"path_adjusted" jsonb,
	"path_alternative" jsonb,
	"selected_path" "selected_path",
	"selected_at" timestamp with time zone,
	"idempotency_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"validation_kind" "validation_kind" DEFAULT 'unknown' NOT NULL,
	"payload_version" integer DEFAULT 1 NOT NULL,
	"selected_path_type" text,
	"tier" "user_tier",
	"intelligence_payload" jsonb,
	"blueprint_contract" jsonb,
	"launch_blocked" boolean DEFAULT false NOT NULL,
	"readiness" "validation_readiness",
	"adjusted_path_confirmed" boolean DEFAULT false NOT NULL,
	"location_country" text,
	"location_city" text,
	"business_type" text,
	"business_model" text,
	"budget_available" double precision,
	"currency" text,
	"current_resources" jsonb,
	"target_customer" text,
	"desired_outcome" text,
	"known_blockers" jsonb,
	"commitment_level" text,
	"market_score" double precision,
	"execution_score" double precision,
	"timing_score" double precision,
	"competition_score" double precision,
	"scalability_score" double precision,
	"local_economy_score" double precision,
	"resource_score" double precision,
	"blueprint_difficulty_score" double precision,
	"risk_score" double precision,
	"momentum_potential" double precision,
	"trust_building_score" double precision,
	"reality_score" double precision,
	"archetype_resolution" jsonb,
	"purpose_decomposition" jsonb,
	"industry_intelligence" jsonb,
	"market_analysis" jsonb,
	"competitor_analysis" jsonb,
	"economy_briefing" jsonb,
	"customer_pain_analysis" jsonb,
	"timing_analysis" jsonb,
	"execution_difficulty" jsonb,
	"time_simulations" jsonb,
	"industry_pros" jsonb,
	"industry_cons" jsonb,
	"winner_analysis" jsonb,
	"first_week_plan" jsonb,
	"recommended_blueprint_level" text,
	"erector_payload" jsonb,
	"erector_validation_stage" text DEFAULT 'pending',
	"economic_context" jsonb,
	"enriched_competitors" jsonb,
	"enriched_opportunities" jsonb,
	"report_generated_at" timestamp with time zone,
	"report_url" text,
	"validation_stage" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verdict_evolution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"validation_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"previous_verdict" text,
	"new_verdict" text NOT NULL,
	"change_summary" text,
	"improved" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"week_end" timestamp with time zone NOT NULL,
	"wins" text,
	"failures" text,
	"patterns" text,
	"next_focus" text,
	"reflection" text,
	"patterns_detected" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issues_identified" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"goal_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signal_trajectory" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"motivation_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"market_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"identity_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"environmental_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"last_drift_calculation" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "world_models_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "xp_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"xp_amount" integer NOT NULL,
	"xp_source" text NOT NULL,
	"source_id" text,
	"multiplier_applied" double precision DEFAULT 1 NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academy_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric_date" text NOT NULL,
	"courses_in_progress" integer DEFAULT 0 NOT NULL,
	"courses_completed" integer DEFAULT 0 NOT NULL,
	"lessons_completed" integer DEFAULT 0 NOT NULL,
	"average_lesson_score" double precision,
	"total_study_time_minutes" integer DEFAULT 0 NOT NULL,
	"concepts_mastered" integer DEFAULT 0 NOT NULL,
	"concepts_weak" integer DEFAULT 0 NOT NULL,
	"average_practice_score" double precision,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric_date" text NOT NULL,
	"posts_published" integer DEFAULT 0 NOT NULL,
	"total_engagement" integer DEFAULT 0 NOT NULL,
	"average_engagement_per_post" double precision DEFAULT 0 NOT NULL,
	"total_reach" integer DEFAULT 0 NOT NULL,
	"total_impressions" integer DEFAULT 0 NOT NULL,
	"audience_growth_percent" double precision DEFAULT 0 NOT NULL,
	"best_performing_content_id" uuid,
	"best_performing_platform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"insight_type" text NOT NULL,
	"insight_text" text NOT NULL,
	"confidence" double precision DEFAULT 0.7 NOT NULL,
	"actionable_recommendation" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric_date" text NOT NULL,
	"total_orders_created" integer DEFAULT 0 NOT NULL,
	"total_orders_completed" integer DEFAULT 0 NOT NULL,
	"completion_rate" double precision DEFAULT 0 NOT NULL,
	"partial_completions" integer DEFAULT 0 NOT NULL,
	"failed_orders" integer DEFAULT 0 NOT NULL,
	"skipped_orders" integer DEFAULT 0 NOT NULL,
	"average_order_score" double precision,
	"average_time_to_complete" integer,
	"orders_completed_on_time" integer DEFAULT 0 NOT NULL,
	"orders_completed_late" integer DEFAULT 0 NOT NULL,
	"execution_momentum" double precision DEFAULT 0 NOT NULL,
	"condition_distribution" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"peak_productivity_hour" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric_name" text NOT NULL,
	"current_value" double precision DEFAULT 0 NOT NULL,
	"personal_best" double precision,
	"personal_worst" double precision,
	"average_value" double precision,
	"trend" text DEFAULT 'stable' NOT NULL,
	"days_to_beat_record" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pattern_type" text NOT NULL,
	"pattern_description" text NOT NULL,
	"frequency" integer DEFAULT 0 NOT NULL,
	"impact" double precision DEFAULT 0 NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actionable_insight" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_velocity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"window_start_date" text NOT NULL,
	"window_end_date" text NOT NULL,
	"window_type" text DEFAULT 'daily' NOT NULL,
	"orders_completed" integer DEFAULT 0 NOT NULL,
	"orders_per_day" double precision DEFAULT 0 NOT NULL,
	"trend" text DEFAULT 'stable' NOT NULL,
	"trend_percentage" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failure_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"failed_order_id" uuid,
	"failure_reason" text,
	"failure_category" text,
	"severity" integer DEFAULT 3 NOT NULL,
	"pattern_count" integer DEFAULT 1 NOT NULL,
	"prediction_confidence" double precision DEFAULT 0.5 NOT NULL,
	"suggested_prevention" text,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_velocity_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"window_start_date" text NOT NULL,
	"window_end_date" text NOT NULL,
	"window_type" text DEFAULT 'weekly' NOT NULL,
	"lessons_completed" integer DEFAULT 0 NOT NULL,
	"hours_studied" double precision DEFAULT 0 NOT NULL,
	"concepts_mastered" integer DEFAULT 0 NOT NULL,
	"velocity_trend" text DEFAULT 'stable' NOT NULL,
	"estimated_completion_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"metric_date" text NOT NULL,
	"posts_published" integer DEFAULT 0 NOT NULL,
	"total_engagement" integer DEFAULT 0 NOT NULL,
	"total_reach" integer DEFAULT 0 NOT NULL,
	"total_impressions" integer DEFAULT 0 NOT NULL,
	"average_engagement_rate" double precision DEFAULT 0 NOT NULL,
	"top_post_engagement" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"principle_id" uuid,
	"post_id" text NOT NULL,
	"platform" text NOT NULL,
	"title" text,
	"content_summary" text,
	"published_at" timestamp with time zone,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"retweets" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"engagement_rate" double precision DEFAULT 0 NOT NULL,
	"virality_score" double precision DEFAULT 0 NOT NULL,
	"audience_segment_reached" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "principle_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"principle_id" uuid,
	"metric_date" text NOT NULL,
	"applied_today" boolean DEFAULT false NOT NULL,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"proof_submitted" boolean DEFAULT false NOT NULL,
	"content_published" boolean DEFAULT false NOT NULL,
	"content_platforms" integer DEFAULT 0 NOT NULL,
	"total_engagement" integer DEFAULT 0 NOT NULL,
	"correlation_to_execution" double precision,
	"applied_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "principle_effectiveness" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"principle_id" uuid NOT NULL,
	"effectiveness_score" double precision DEFAULT 50 NOT NULL,
	"application_count" integer DEFAULT 0 NOT NULL,
	"average_order_score_when_applied" double precision,
	"average_order_score_when_not_applied" double precision,
	"correlation_strength" double precision DEFAULT 0 NOT NULL,
	"trend" text DEFAULT 'stable' NOT NULL,
	"last_evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "principle_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"principle_id" uuid,
	"insight_type" text NOT NULL,
	"insight_text" text NOT NULL,
	"confidence" double precision DEFAULT 0.7 NOT NULL,
	"actionable_recommendation" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productivity_heatmap" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"hour_of_day" integer NOT NULL,
	"orders_completed" integer DEFAULT 0 NOT NULL,
	"completion_rate" double precision DEFAULT 0 NOT NULL,
	"average_score" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weak_areas_detected" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"concept_id" text NOT NULL,
	"weakness_description" text NOT NULL,
	"mastery_level" double precision DEFAULT 0 NOT NULL,
	"attempts_failed" integer DEFAULT 0 NOT NULL,
	"common_mistake" text,
	"recommended_action" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger" text NOT NULL,
	"trigger_conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_conflicts_external" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"torgima_event_id" uuid,
	"external_event_id" text NOT NULL,
	"external_calendar" text NOT NULL,
	"conflict_type" text DEFAULT 'time-overlap' NOT NULL,
	"resolution_strategy" text DEFAULT 'manual' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"sync_direction" text NOT NULL,
	"events_synced" integer DEFAULT 0 NOT NULL,
	"events_created" integer DEFAULT 0 NOT NULL,
	"events_updated" integer DEFAULT 0 NOT NULL,
	"events_deleted" integer DEFAULT 0 NOT NULL,
	"sync_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"error_details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_post_mapping_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"engagement_rate" double precision DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"integration_type" text NOT NULL,
	"is_connected" boolean DEFAULT false NOT NULL,
	"oauth_token_encrypted" text,
	"oauth_refresh_token_encrypted" text,
	"oauth_scope" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"account_identifier" text,
	"last_sync_time" timestamp with time zone,
	"last_sync_status" text DEFAULT 'pending' NOT NULL,
	"last_sync_error" text,
	"sync_frequency" text DEFAULT 'hourly' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_data_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"integration_id" uuid,
	"metric_type" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"source_date" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"response_status" integer,
	"response_body" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"webhook_url" text NOT NULL,
	"event_type" text NOT NULL,
	"secret" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_post_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"published_content_id" uuid,
	"platform" text NOT NULL,
	"external_post_id" text,
	"external_post_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zapier_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"zapier_id" text NOT NULL,
	"integration_type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accountability_pledges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pledge_text" text NOT NULL,
	"deadline" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_social_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"widget_type" text NOT NULL,
	"embed_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_profile_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"viewer_id" uuid,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"referrer_source" text DEFAULT 'direct' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shareable_daily_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_date" text NOT NULL,
	"principle_id" uuid,
	"daily_record_id" uuid,
	"share_token" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"reaction_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shareable_daily_entries_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "bhudhi_belief_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"belief_id_a" uuid,
	"belief_id_b" uuid,
	"conflict_type" text NOT NULL,
	"description" text NOT NULL,
	"action" text DEFAULT 'investigate' NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_belief_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"belief_id" uuid NOT NULL,
	"source" text NOT NULL,
	"reliability" double precision DEFAULT 0.5 NOT NULL,
	"recency" double precision DEFAULT 0.5 NOT NULL,
	"agreement" double precision DEFAULT 0.5 NOT NULL,
	"repeatability" double precision DEFAULT 0.5 NOT NULL,
	"evidence_score" double precision DEFAULT 0.5 NOT NULL,
	"strength" text DEFAULT 'moderate' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_belief_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"belief_id" uuid NOT NULL,
	"change_type" text NOT NULL,
	"previous_state" text,
	"new_state" text NOT NULL,
	"reason" text NOT NULL,
	"confidence_before" double precision,
	"confidence_after" double precision,
	"quality_score" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_belief_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid,
	"trigger" text,
	"belief_type" text NOT NULL,
	"statement" text NOT NULL,
	"origin" text NOT NULL,
	"state" text DEFAULT 'OBSERVED' NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"truth_score" double precision,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_belief_truth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"belief_id" uuid NOT NULL,
	"truth_score" double precision NOT NULL,
	"stability" double precision DEFAULT 0.5 NOT NULL,
	"certainty" double precision DEFAULT 0.5 NOT NULL,
	"category" text DEFAULT 'LOCAL' NOT NULL,
	"conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_civilization_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"civilization_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_civilization_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"civilization_id" uuid NOT NULL,
	"horizon_years" integer NOT NULL,
	"trajectory" text NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"forecast" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_civilization_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"civilization_id" uuid,
	"memory_type" text NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_civilization_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"civilization_id" uuid NOT NULL,
	"phase" text NOT NULL,
	"population_health" double precision DEFAULT 0.5 NOT NULL,
	"institution_effectiveness" double precision DEFAULT 0.5 NOT NULL,
	"ecosystem_health" double precision DEFAULT 0.5 NOT NULL,
	"economic_trajectory" text DEFAULT 'stable' NOT NULL,
	"resilience_score" integer DEFAULT 50 NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_civilizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"name" text DEFAULT 'Blueprint Civilization' NOT NULL,
	"civilization_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resilience" double precision DEFAULT 0.5 NOT NULL,
	"trajectory" text DEFAULT 'stable' NOT NULL,
	"evolution_mode" text DEFAULT 'stable' NOT NULL,
	"seed" text NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_context_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"current_domain" text NOT NULL,
	"current_phase" text NOT NULL,
	"resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"urgency" text NOT NULL,
	"clarity" double precision DEFAULT 0.5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_decision_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"horizon_days" integer NOT NULL,
	"best_outcome" double precision NOT NULL,
	"expected_outcome" double precision NOT NULL,
	"worst_outcome" double precision NOT NULL,
	"probabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scenario_tree" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_decision_options" (
	"id" text NOT NULL,
	"decision_id" uuid NOT NULL,
	"label" text NOT NULL,
	"option_type" text NOT NULL,
	"description" text NOT NULL,
	"cost" double precision DEFAULT 0 NOT NULL,
	"timeline_days" integer DEFAULT 0 NOT NULL,
	"risk" double precision DEFAULT 0.5 NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"expected_value" double precision DEFAULT 0 NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"tradeoffs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bhudhi_decision_options_decision_id_id_pk" PRIMARY KEY("decision_id","id")
);
--> statement-breakpoint
CREATE TABLE "bhudhi_decision_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"recommendation_id" uuid,
	"trigger" text NOT NULL,
	"goal" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"selected_option_id" text,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"confidence_level" text DEFAULT 'MEDIUM' NOT NULL,
	"explanation" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"governance_escalated" boolean DEFAULT false NOT NULL,
	"actual_outcome" jsonb,
	"regret_score" double precision,
	"quality_score" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_decision_replay" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"replay_type" text NOT NULL,
	"branch_option_id" text,
	"what_happened" text NOT NULL,
	"what_should_happen" text NOT NULL,
	"what_would_happen" text NOT NULL,
	"learnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_decision_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"option_id" text NOT NULL,
	"expected_value" double precision NOT NULL,
	"regret" double precision DEFAULT 0 NOT NULL,
	"upside" double precision DEFAULT 0 NOT NULL,
	"downside" double precision DEFAULT 0 NOT NULL,
	"recommendation" text NOT NULL,
	"tradeoff_matrix" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"active_frameworks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"framework_roles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bhudhi_domains_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bhudhi_economics_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"horizon_days" integer NOT NULL,
	"forecast_cost_usd" double precision NOT NULL,
	"forecast_tokens" integer NOT NULL,
	"forecast_requests" integer NOT NULL,
	"forecast_memory_mb" double precision DEFAULT 0 NOT NULL,
	"forecast_simulation_hours" double precision DEFAULT 0 NOT NULL,
	"confidence" double precision DEFAULT 0.7 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_economics_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"category" text NOT NULL,
	"amount_usd" double precision DEFAULT 0 NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_economics_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"daily_token_budget" integer DEFAULT 100000 NOT NULL,
	"daily_usd_budget" double precision DEFAULT 5 NOT NULL,
	"target_confidence" double precision DEFAULT 0.8 NOT NULL,
	"execution_mode" text DEFAULT 'STANDARD' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_economics_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_economics_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blueprint_id" uuid,
	"trigger_type" text NOT NULL,
	"execution_mode" text NOT NULL,
	"route" text NOT NULL,
	"model_id" text NOT NULL,
	"estimated_cost_usd" double precision DEFAULT 0 NOT NULL,
	"actual_cost_usd" double precision,
	"estimated_latency_ms" integer DEFAULT 0 NOT NULL,
	"actual_latency_ms" integer,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"confidence_target" double precision DEFAULT 0.8 NOT NULL,
	"value_score" double precision DEFAULT 0 NOT NULL,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"roi_action" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_engine_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engine_id" text NOT NULL,
	"engine_name" text NOT NULL,
	"system" text NOT NULL,
	"accepts_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emits_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requires_context" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"produces_context" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"health_check" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bhudhi_engine_registry_engine_id_unique" UNIQUE("engine_id")
);
--> statement-breakpoint
CREATE TABLE "bhudhi_engines" (
	"id" text PRIMARY KEY NOT NULL,
	"system_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{"executionsCount":0,"successRate":0,"averageExecutionTime":0,"lastResultCount":0}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_execution_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"contract_type" text NOT NULL,
	"execution_id" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"event_chain_id" text,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"stack_trace" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_execution_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"description" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"learnings_generated" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"frameworks_improved" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_execution_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"recommendation_id" uuid,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeline" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monitoring" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_expansion_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capability_id" uuid NOT NULL,
	"gain" double precision DEFAULT 0 NOT NULL,
	"cost" double precision DEFAULT 0 NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"benchmark" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_expansion_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"capability_key" text NOT NULL,
	"origin" text NOT NULL,
	"level" text DEFAULT 'LOCAL' NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"score" double precision DEFAULT 0.5 NOT NULL,
	"risk" double precision DEFAULT 0.3 NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_expansion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"capability_id" uuid,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_expansion_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"action" text NOT NULL,
	"capability_key" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_expansion_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"memory_type" text NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_experiment_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"group_key" text NOT NULL,
	"label" text NOT NULL,
	"allocation_weight" double precision DEFAULT 0.25 NOT NULL,
	"exposure_count" integer DEFAULT 0 NOT NULL,
	"completion_count" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_experiment_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"memory_type" text NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_experiment_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"action" text NOT NULL,
	"winner_group" text,
	"confidence" double precision NOT NULL,
	"repeatability" double precision NOT NULL,
	"governance_ok" boolean DEFAULT false NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_experiment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"group_id" uuid,
	"delta" double precision DEFAULT 0 NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"effect_size" double precision DEFAULT 0 NOT NULL,
	"verdict" text,
	"causal" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"goal" text NOT NULL,
	"hypothesis" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"duration_days" integer DEFAULT 7 NOT NULL,
	"sample_size" integer DEFAULT 100 NOT NULL,
	"confidence_target" double precision DEFAULT 0.95 NOT NULL,
	"success_criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_external_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"system_name" text NOT NULL,
	"system_type" text NOT NULL,
	"api_key_encrypted" text,
	"api_endpoint" text,
	"credentials_encrypted" text,
	"sync_frequency" text DEFAULT 'daily' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"next_sync_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_external_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"data_type" text NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"normalized_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"investigation_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_framework_learning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" text NOT NULL,
	"learning_type" text NOT NULL,
	"previous_accuracy" double precision NOT NULL,
	"new_accuracy" double precision NOT NULL,
	"improvement" double precision NOT NULL,
	"source_event" uuid,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending_validation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_frameworks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"logic" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"accuracy" double precision DEFAULT 0.5 NOT NULL,
	"confidence_threshold" double precision DEFAULT 0.7 NOT NULL,
	"improvement_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weekly_accuracy" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bhudhi_frameworks_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bhudhi_governance_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"action" text NOT NULL,
	"level" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approver_type" text,
	"approver_id" text,
	"rejection_reason" text,
	"expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_governance_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"decision" text NOT NULL,
	"reasoning" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_id" uuid,
	"result" text,
	"rollback_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_governance_emergency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid,
	"mode" text NOT NULL,
	"trigger" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bhudhi_governance_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid,
	"memory_type" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_governance_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"violation_type" text NOT NULL,
	"severity" text NOT NULL,
	"detail" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_governor_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"allocated" double precision DEFAULT 0 NOT NULL,
	"waste" double precision DEFAULT 0 NOT NULL,
	"recommendation" text,
	"allocation_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_governor_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"subsystem" text,
	"action" text NOT NULL,
	"priority_level" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_governor_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"quality" double precision DEFAULT 0.5 NOT NULL,
	"drift" double precision DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"coordination" double precision DEFAULT 0.5 NOT NULL,
	"efficiency" double precision DEFAULT 0.5 NOT NULL,
	"system_health" text DEFAULT 'stable' NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_governor_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"priority_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"interventions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"execution_plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_governor_recovery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"recovery_mode" text NOT NULL,
	"target_subsystem" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"preserved_history" boolean DEFAULT true NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_idea_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"problem" text NOT NULL,
	"ideas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feasibility" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_idea" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_identity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"profile_id" uuid,
	"event_type" text NOT NULL,
	"description" text NOT NULL,
	"action" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_identity_growth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"current_state" text NOT NULL,
	"next_identity" text,
	"maturity" double precision DEFAULT 0.5 NOT NULL,
	"stability" double precision DEFAULT 0.5 NOT NULL,
	"recommended_transitions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_identity_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"change_type" text NOT NULL,
	"previous_snapshot" jsonb,
	"new_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_identity_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid,
	"execution_profile" text DEFAULT 'Builder' NOT NULL,
	"personality" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"motivations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"identity_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"growth_direction" text,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_identity_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"value_key" text NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"protected" boolean DEFAULT false NOT NULL,
	"temporary" boolean DEFAULT false NOT NULL,
	"weight" double precision DEFAULT 0.5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_incident_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"owner" text,
	"sla_hours" integer,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bhudhi_infra_capacity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"cpu" double precision DEFAULT 0 NOT NULL,
	"memory" double precision DEFAULT 0 NOT NULL,
	"gpu" double precision DEFAULT 0 NOT NULL,
	"storage" double precision DEFAULT 0 NOT NULL,
	"network" double precision DEFAULT 0 NOT NULL,
	"utilization" double precision DEFAULT 0 NOT NULL,
	"waste" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_infra_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"strategy" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rollback_available" boolean DEFAULT true NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_infra_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"environment" text NOT NULL,
	"risk" double precision DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_infra_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"availability" double precision DEFAULT 0.99 NOT NULL,
	"load" double precision DEFAULT 0 NOT NULL,
	"error_rate" double precision DEFAULT 0 NOT NULL,
	"latency_p99_ms" integer DEFAULT 0 NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_infra_runtime" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"runtime_type" text NOT NULL,
	"health" double precision DEFAULT 0.5 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"throughput" double precision DEFAULT 0 NOT NULL,
	"stability" double precision DEFAULT 0.5 NOT NULL,
	"recommendation" text,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"engine_id" text NOT NULL,
	"subject" text NOT NULL,
	"findings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"severity" text DEFAULT 'low' NOT NULL,
	"actionable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_kernel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"source_engine" text NOT NULL,
	"target_engine" text DEFAULT 'broadcast' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'emitted' NOT NULL,
	"processed_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parent_event_id" uuid,
	"chain_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_memory_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"from_node_id" uuid NOT NULL,
	"to_node_id" uuid NOT NULL,
	"edge_type" text NOT NULL,
	"strength" double precision DEFAULT 0.7 NOT NULL,
	"bidirectional" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_memory_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"node_type" text NOT NULL,
	"node_id" text NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text NOT NULL,
	"source_engine" text NOT NULL,
	"source_event" text,
	"confidence" double precision DEFAULT 0.75 NOT NULL,
	"importance" double precision DEFAULT 0.5 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_access_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_memory_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"query" text NOT NULL,
	"node_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"execution_time_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bhudhi_memory_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"node_id_1" uuid NOT NULL,
	"node_id_2" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"strength" double precision DEFAULT 0.7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_memory_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"node_id" uuid,
	"event" text NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_model_capabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"provider" text NOT NULL,
	"cost_per_million" double precision NOT NULL,
	"latency_ms" integer DEFAULT 3000 NOT NULL,
	"quality" double precision DEFAULT 0.75 NOT NULL,
	"risk" double precision DEFAULT 0.2 NOT NULL,
	"reliability" double precision DEFAULT 0.85 NOT NULL,
	"memory_fit" double precision DEFAULT 0.7 NOT NULL,
	"tool_fit" double precision DEFAULT 0.5 NOT NULL,
	"simulation_fit" double precision DEFAULT 0.5 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bhudhi_model_capabilities_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "bhudhi_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"system" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"outputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"logic" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"accuracy" double precision DEFAULT 0.75 NOT NULL,
	"execution_time_ms" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bhudhi_modules_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bhudhi_organization_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"description" text NOT NULL,
	"action" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_organization_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"execution_score" double precision DEFAULT 0.5 NOT NULL,
	"culture_score" double precision DEFAULT 0.5 NOT NULL,
	"strategy_score" double precision DEFAULT 0.5 NOT NULL,
	"risk_score" double precision DEFAULT 0.5 NOT NULL,
	"resilience_score" double precision DEFAULT 0.5 NOT NULL,
	"overall_score" integer DEFAULT 50 NOT NULL,
	"action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_organization_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"memory_type" text NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_organization_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"role_key" text NOT NULL,
	"authority_level" text DEFAULT 'MEMBER' NOT NULL,
	"department" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"name" text NOT NULL,
	"organization_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"capacity" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alignment" double precision DEFAULT 0.5 NOT NULL,
	"health_score" integer DEFAULT 50 NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_permission_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"subject_id" text NOT NULL,
	"permission" text NOT NULL,
	"allowed" boolean DEFAULT false NOT NULL,
	"constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approvals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"scenario" text NOT NULL,
	"forecast" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"timeline" integer DEFAULT 0 NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opportunities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_protocol_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engine_a" text NOT NULL,
	"engine_b" text NOT NULL,
	"message_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"guarantees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_protocol_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"message_type" text NOT NULL,
	"from_engine" text NOT NULL,
	"to_engine" text DEFAULT 'broadcast' NOT NULL,
	"uri" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"route_id" text NOT NULL,
	"sequence_number" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_protocol_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern" text NOT NULL,
	"handler" text NOT NULL,
	"request_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"async" boolean DEFAULT true NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"retries" integer DEFAULT 3 NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"engine_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reasoning" text NOT NULL,
	"expected_impact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"implementation_difficulty" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_recovery_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"strategy" text NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"estimated_recovery_minutes" integer DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_reliability_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"severity" text,
	"health" double precision DEFAULT 0.5 NOT NULL,
	"risk" double precision DEFAULT 0 NOT NULL,
	"failure_probability" double precision DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_rollback_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"target" text NOT NULL,
	"mode" text NOT NULL,
	"preserved_history" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_secret_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"secret_key" text NOT NULL,
	"secret_type" text NOT NULL,
	"vault_ref" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked" boolean DEFAULT false NOT NULL,
	"rotated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text,
	"trust_score" double precision DEFAULT 0.5 NOT NULL,
	"risk" double precision DEFAULT 0 NOT NULL,
	"decision" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_shared_context" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"domain" text DEFAULT 'genesis' NOT NULL,
	"phase" text DEFAULT 'initiation' NOT NULL,
	"signal" text DEFAULT 'nothingness' NOT NULL,
	"condition" text DEFAULT 'nothingness' NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ideas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"strategy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"predictions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"knowledge" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"behavior" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"execution" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"investigations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_update_engine" text DEFAULT 'system' NOT NULL,
	"last_update_time" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bhudhi_shared_context_blueprint_id_unique" UNIQUE("blueprint_id")
);
--> statement-breakpoint
CREATE TABLE "bhudhi_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"global_signal" text NOT NULL,
	"global_signal_confidence" double precision DEFAULT 0.5 NOT NULL,
	"framework_signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"execution_score" double precision,
	"momentum" double precision,
	"feedback_confidence" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_simulation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_simulation_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"memory_type" text NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_simulation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulation_id" uuid NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"world_id" uuid,
	"goal" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"outcomes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"recommendation" text,
	"seed" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_simulation_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"survival" integer DEFAULT 50 NOT NULL,
	"goal_achievement" integer DEFAULT 50 NOT NULL,
	"efficiency" integer DEFAULT 50 NOT NULL,
	"resilience" integer DEFAULT 50 NOT NULL,
	"risk" integer DEFAULT 50 NOT NULL,
	"overall" integer DEFAULT 50 NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_simulation_worlds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"mode" text DEFAULT 'STANDARD' NOT NULL,
	"seed" text NOT NULL,
	"world" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"realism" double precision DEFAULT 0.7 NOT NULL,
	"difficulty" double precision DEFAULT 0.5 NOT NULL,
	"volatility" double precision DEFAULT 0.3 NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_strategic_choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selected" text NOT NULL,
	"reasoning" text NOT NULL,
	"alignment" double precision DEFAULT 0.5 NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_system_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"resilience_score" integer DEFAULT 50 NOT NULL,
	"uptime" double precision DEFAULT 0.99 NOT NULL,
	"availability" double precision DEFAULT 0.99 NOT NULL,
	"continuity_mode" text DEFAULT 'ONLINE' NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_systems" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_analyzed_at" timestamp with time zone,
	"engine_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bhudhi_systems_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bhudhi_team_alignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"goal_alignment" double precision DEFAULT 0.5 NOT NULL,
	"strategy_alignment" double precision DEFAULT 0.5 NOT NULL,
	"identity_alignment" double precision DEFAULT 0.5 NOT NULL,
	"conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_team_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"score" integer DEFAULT 50 NOT NULL,
	"burnout" double precision DEFAULT 0 NOT NULL,
	"load" double precision DEFAULT 0 NOT NULL,
	"trust" double precision DEFAULT 0.5 NOT NULL,
	"momentum" double precision DEFAULT 0.5 NOT NULL,
	"engagement" double precision DEFAULT 0.5 NOT NULL,
	"action" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_team_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"mission" text,
	"values" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blindspots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"working_style" text,
	"health" double precision DEFAULT 0.5 NOT NULL,
	"drift" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_team_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"memory_type" text NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"name" text NOT NULL,
	"team_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alignment" double precision DEFAULT 0.5 NOT NULL,
	"capacity" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommendation" text,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_temporal_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"horizon_days" integer NOT NULL,
	"forecast" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"adjustments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_temporal_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"time_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"urgency" double precision DEFAULT 0.5 NOT NULL,
	"recommendation" text NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_temporal_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"pattern_type" text NOT NULL,
	"description" text NOT NULL,
	"momentum_mode" text,
	"score" double precision DEFAULT 0.5 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_temporal_timelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"goal" text,
	"timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ordering" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"causes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"health" double precision DEFAULT 0.5 NOT NULL,
	"buffer_days" integer DEFAULT 0 NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_temporal_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"window_type" text NOT NULL,
	"label" text NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"score" integer DEFAULT 50 NOT NULL,
	"success_probability" double precision DEFAULT 0.5 NOT NULL,
	"expires_at" timestamp with time zone,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_threat_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"threat" text NOT NULL,
	"severity" text NOT NULL,
	"containment" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_trust_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"subject_id" text NOT NULL,
	"trust_level" text DEFAULT 'LIMITED' NOT NULL,
	"trust_score" double precision DEFAULT 0.5 NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_unified_execution_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"execution_type" text NOT NULL,
	"execution_id" text NOT NULL,
	"action" text DEFAULT '' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"estimated_end" timestamp with time zone,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feedback" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_unified_execution_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" text NOT NULL,
	"feedback_type" text NOT NULL,
	"message" text NOT NULL,
	"source" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_unified_execution_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" text NOT NULL,
	"success" boolean NOT NULL,
	"outcome" text NOT NULL,
	"metrics_accuracy" double precision DEFAULT 0 NOT NULL,
	"metrics_speed_ms" integer DEFAULT 0 NOT NULL,
	"metrics_quality" double precision DEFAULT 0 NOT NULL,
	"learnings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"improvements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_unified_execution_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" text NOT NULL,
	"step_number" integer NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"depends_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_world_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"label" text NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"relationships" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_world_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_id" uuid,
	"cause" text,
	"impact" double precision DEFAULT 0 NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_world_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"from_entity_id" uuid NOT NULL,
	"to_entity_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"weight" double precision DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_world_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"world_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"memory_class" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bhudhi_world_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"entity_id" uuid,
	"state_type" text DEFAULT 'DYNAMIC' NOT NULL,
	"before_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"predicted_state" jsonb,
	"desired_state" jsonb,
	"delta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_sequence_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"sequence_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"state_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validation_passed" boolean DEFAULT false NOT NULL,
	"validation_errors" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"duration_ms" integer,
	"user_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"current_sequence" integer DEFAULT 1 NOT NULL,
	"current_sequence_name" text DEFAULT 'GOAL' NOT NULL,
	"completed_sequences" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"sequence_timestamps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sequence_states" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sequence_validation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprint_tier_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"selected_tier" text NOT NULL,
	"tier_rules" jsonb,
	"complexity_level" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"timeframe" integer,
	"location" text,
	"business_type" text,
	"delivery" text,
	"people_count" integer,
	"commitment" text,
	"budget" double precision,
	"limits" text[],
	"execution_pressure" double precision,
	"capability_expected" text,
	"workload_model" jsonb,
	"operating_rules" jsonb,
	"constraint_forecast" jsonb,
	"recovery_models" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_feedback_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"execution_output" text,
	"execution_result" jsonb,
	"execution_speed" double precision,
	"execution_behavior" jsonb,
	"execution_pattern" text,
	"completion" text,
	"score" integer,
	"reflection" text,
	"confidence" double precision,
	"interrogation" jsonb,
	"behavior_extracted" jsonb,
	"reality_learning" jsonb,
	"contradictions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_structure_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"targets" jsonb,
	"target_control" jsonb,
	"target_tree" jsonb,
	"target_compounding" jsonb,
	"target_forecast" jsonb,
	"phases" text[],
	"phase_gates" jsonb,
	"phase_flex" jsonb,
	"project_structure" jsonb,
	"action_types" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"goal_text" text NOT NULL,
	"outcome" text,
	"intent" text,
	"category" text,
	"direction" text,
	"success_metrics" jsonb,
	"expected_outputs" text[],
	"goal_score" double precision,
	"current_goal" text,
	"expected_goal" text,
	"future_goal" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_plan_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"mission" text,
	"success" text,
	"rules" text[],
	"deliverables" text[],
	"progress_governance" jsonb,
	"governance_type" text,
	"change_detection" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mini_plan_allocation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"condition" text NOT NULL,
	"allocation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"daily_task_counts" jsonb,
	"previous_condition" text,
	"reason" text,
	"tasks_affected" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mini_plan_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"mini_plans" text[],
	"cross_plan_prep" jsonb,
	"dependency_aware" jsonb,
	"can_compete" boolean DEFAULT true NOT NULL,
	"can_collaborate" boolean DEFAULT true NOT NULL,
	"can_reallocate" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"do_rules" text[],
	"dont_rules" text[],
	"winning_rules" text[],
	"failure_rules" text[],
	"operational_standard" text[],
	"task_influence" jsonb,
	"failure_patterns" text[],
	"adaptive_policies" jsonb,
	"conditional_policies" jsonb,
	"learning_policies" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_scene_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"future_scene" text,
	"expected_risk" jsonb,
	"probability" double precision,
	"queue_mutation" jsonb,
	"next_orders" jsonb,
	"regeneration_trigger" text,
	"current_scene" text,
	"expected_scene" text,
	"ideal_scene" text,
	"how_to_move_forward" text,
	"projected_scene" text,
	"scene_probability" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purpose_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"purpose_text" text NOT NULL,
	"problem" text,
	"value" text,
	"change" text,
	"mission" text,
	"target_user" text,
	"desired_change" text,
	"execution_intent" text,
	"purpose_hierarchy" jsonb,
	"purpose_durability" double precision,
	"purpose_conflict" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"total_sequences" integer NOT NULL,
	"completed_sequences" integer DEFAULT 0 NOT NULL,
	"current_sequence_num" integer DEFAULT 1 NOT NULL,
	"current_sequence_name" text DEFAULT 'GOAL' NOT NULL,
	"flow_path" text[] NOT NULL,
	"sequence_duration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_condition_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"signal_progress" double precision,
	"signal_momentum" double precision,
	"signal_consistency" double precision,
	"signal_history" jsonb,
	"signal_trend" text,
	"signal_forecast" text,
	"signal_trajectory" jsonb,
	"current_condition" text,
	"task_control" jsonb,
	"difficulty_control" jsonb,
	"permission_control" jsonb,
	"can_reduce" boolean,
	"can_increase" boolean,
	"can_delay" boolean,
	"can_prioritize" boolean,
	"adaptation_triggered" boolean DEFAULT false NOT NULL,
	"adaptation_type" text,
	"correction_tasks" text[],
	"recovery_tasks" text[],
	"rebuild" boolean,
	"restructure" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"signals" text[],
	"signal_history" jsonb,
	"signal_trend" jsonb,
	"signal_momentum" jsonb,
	"signal_forecast" jsonb,
	"signal_pressure" jsonb,
	"signal_probability" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_generation_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"current_orders" jsonb,
	"current_order_count" integer,
	"hidden_orders" jsonb,
	"hidden_queue_length" integer,
	"task_mutation" jsonb,
	"context_injection" text[],
	"future_orders" jsonb,
	"emergency_orders" jsonb,
	"opportunity_orders" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_sequence_gates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_tier" text NOT NULL,
	"sequence_number" integer NOT NULL,
	"unlocks_after_seq" integer,
	"requires_tier" text,
	"unlocks_feature" text,
	"feature_description" text,
	"is_growth_only" boolean DEFAULT false NOT NULL,
	"is_ultimate_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_result_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"selected_path" text,
	"path_memory" jsonb,
	"expected_scenario" jsonb,
	"failure_scenario" jsonb,
	"recovery_scenario" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"reality_result" text,
	"demand" double precision,
	"competition" text,
	"timing" text,
	"feasibility" double precision,
	"risk" text,
	"current_path" text,
	"adjusted_path" text,
	"alternative_path" text,
	"verdict" text,
	"risk_weight" jsonb,
	"path_comparison" jsonb,
	"feasibility_score" double precision,
	"validation_drift" double precision,
	"live_revalidation" timestamp with time zone,
	"execution_forecast" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adaptation_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"pattern_detected" text NOT NULL,
	"category" text NOT NULL,
	"current_behavior" text NOT NULL,
	"suggested_change" text NOT NULL,
	"reasoning" text NOT NULL,
	"confidence" double precision NOT NULL,
	"user_applied" boolean DEFAULT false NOT NULL,
	"applied_date" timestamp with time zone,
	"effectiveness" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_execution_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"pattern_type" text NOT NULL,
	"pattern_name" text NOT NULL,
	"detected_at_seq" integer NOT NULL,
	"occurrence_count" integer NOT NULL,
	"confidence" double precision NOT NULL,
	"impact" text,
	"is_learnable" boolean DEFAULT true NOT NULL,
	"suggested_fix" text,
	"last_observed" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interrogation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"question" text NOT NULL,
	"context" text NOT NULL,
	"user_answer" text,
	"category" text NOT NULL,
	"insight_extracted" text,
	"insight_actionable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"relevant_at_seq" integer,
	"keyword_triggers" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"viewed_count" integer DEFAULT 0 NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ultimate_emergency_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"trigger_event" text NOT NULL,
	"order_type" text NOT NULL,
	"task_description" text NOT NULL,
	"urgency" text NOT NULL,
	"estimated_impact" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"linked_order_id" uuid,
	"completed_at" timestamp with time zone,
	"effectiveness" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ultimate_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"predicted_task" text NOT NULL,
	"predicted_blockers" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"predicted_duration" integer,
	"task_confidence" double precision NOT NULL,
	"blocker_risk" double precision NOT NULL,
	"accuracy_history" double precision DEFAULT 0.5 NOT NULL,
	"actual_task" text,
	"actual_blockers" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"prediction_correct" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"validated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ultimate_scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"current_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ideal_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current_vs_expected" double precision NOT NULL,
	"expected_vs_ideal" double precision NOT NULL,
	"blocker_gaps" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"opportunity_gaps" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ultimate_validation_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"execution_valid" boolean NOT NULL,
	"prediction_valid" boolean NOT NULL,
	"scene_valid" boolean NOT NULL,
	"validation_errors" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"warnings" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"recovery_needed" boolean DEFAULT false NOT NULL,
	"recovery_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academy_chapters" ADD CONSTRAINT "academy_chapters_course_id_academy_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."academy_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_concept_mastery" ADD CONSTRAINT "academy_concept_mastery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_generated_content" ADD CONSTRAINT "academy_generated_content_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_learning_goals" ADD CONSTRAINT "academy_learning_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_learning_goals" ADD CONSTRAINT "academy_learning_goals_aligned_with_blueprint_id_blueprints_id_fk" FOREIGN KEY ("aligned_with_blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_learning_patterns" ADD CONSTRAINT "academy_learning_patterns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_lesson_attempts" ADD CONSTRAINT "academy_lesson_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_lesson_attempts" ADD CONSTRAINT "academy_lesson_attempts_lesson_id_academy_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."academy_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_lessons" ADD CONSTRAINT "academy_lessons_chapter_id_academy_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."academy_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_practice_attempts" ADD CONSTRAINT "academy_practice_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_practice_attempts" ADD CONSTRAINT "academy_practice_attempts_practice_item_id_academy_practice_items_id_fk" FOREIGN KEY ("practice_item_id") REFERENCES "public"."academy_practice_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_practice_items" ADD CONSTRAINT "academy_practice_items_lesson_id_academy_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."academy_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_proof" ADD CONSTRAINT "academy_proof_academy_task_id_academy_tasks_id_fk" FOREIGN KEY ("academy_task_id") REFERENCES "public"."academy_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_proof" ADD CONSTRAINT "academy_proof_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_retention_data" ADD CONSTRAINT "academy_retention_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_retention_data" ADD CONSTRAINT "academy_retention_data_lesson_id_academy_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."academy_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_roadmap_steps" ADD CONSTRAINT "academy_roadmap_steps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_roadmap_steps" ADD CONSTRAINT "academy_roadmap_steps_learning_goal_id_academy_learning_goals_id_fk" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."academy_learning_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_roadmap_steps" ADD CONSTRAINT "academy_roadmap_steps_course_id_academy_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."academy_courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_student_enrollments" ADD CONSTRAINT "academy_student_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_student_enrollments" ADD CONSTRAINT "academy_student_enrollments_course_id_academy_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."academy_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_student_learning_profiles" ADD CONSTRAINT "academy_student_learning_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_study_schedules" ADD CONSTRAINT "academy_study_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_study_schedules" ADD CONSTRAINT "academy_study_schedules_learning_goal_id_academy_learning_goals_id_fk" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."academy_learning_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_study_sessions" ADD CONSTRAINT "academy_study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_study_sessions" ADD CONSTRAINT "academy_study_sessions_learning_goal_id_academy_learning_goals_id_fk" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."academy_learning_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_study_sessions" ADD CONSTRAINT "academy_study_sessions_schedule_id_academy_study_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."academy_study_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_tasks" ADD CONSTRAINT "academy_tasks_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_tasks" ADD CONSTRAINT "academy_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_tasks" ADD CONSTRAINT "academy_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_tasks" ADD CONSTRAINT "academy_tasks_learning_path_id_learning_paths_id_fk" FOREIGN KEY ("learning_path_id") REFERENCES "public"."learning_paths"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_tasks" ADD CONSTRAINT "academy_tasks_knowledge_id_knowledge_objects_id_fk" FOREIGN KEY ("knowledge_id") REFERENCES "public"."knowledge_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_feedback_sessions" ADD CONSTRAINT "active_feedback_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_feedback_sessions" ADD CONSTRAINT "active_feedback_sessions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_conflict_logs" ADD CONSTRAINT "agent_conflict_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_events" ADD CONSTRAINT "behavior_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_events" ADD CONSTRAINT "behavior_events_pattern_id_behavior_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."behavior_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_events" ADD CONSTRAINT "behavior_events_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_patterns" ADD CONSTRAINT "behavior_patterns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_patterns" ADD CONSTRAINT "behavior_patterns_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavioral_insight_records" ADD CONSTRAINT "behavioral_insight_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_logs" ADD CONSTRAINT "bhudhi_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory" ADD CONSTRAINT "bhudhi_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory" ADD CONSTRAINT "bhudhi_memory_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_usage_budget" ADD CONSTRAINT "bhudhi_usage_budget_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocker_logs" ADD CONSTRAINT "blocker_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocker_logs" ADD CONSTRAINT "blocker_logs_message_id_personal_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."personal_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocker_logs" ADD CONSTRAINT "blocker_logs_related_order_id_orders_id_fk" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_framework_signals" ADD CONSTRAINT "blueprint_framework_signals_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_health_records" ADD CONSTRAINT "blueprint_health_records_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_interpretations" ADD CONSTRAINT "blueprint_interpretations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_members" ADD CONSTRAINT "blueprint_members_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_members" ADD CONSTRAINT "blueprint_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_members" ADD CONSTRAINT "blueprint_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_mutations" ADD CONSTRAINT "blueprint_mutations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_policies" ADD CONSTRAINT "blueprint_policies_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_policies" ADD CONSTRAINT "blueprint_policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_policies" ADD CONSTRAINT "blueprint_policies_ai_log_id_bhudhi_logs_id_fk" FOREIGN KEY ("ai_log_id") REFERENCES "public"."bhudhi_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_tier_migrations" ADD CONSTRAINT "blueprint_tier_migrations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_tier_migrations" ADD CONSTRAINT "blueprint_tier_migrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_versions" ADD CONSTRAINT "blueprint_versions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_primary_archetype_id_economic_archetypes_id_fk" FOREIGN KEY ("primary_archetype_id") REFERENCES "public"."economic_archetypes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "burnout_records" ADD CONSTRAINT "burnout_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_conflicts" ADD CONSTRAINT "calendar_conflicts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_conflicts" ADD CONSTRAINT "calendar_conflicts_event_1_id_calendar_events_id_fk" FOREIGN KEY ("event_1_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_conflicts" ADD CONSTRAINT "calendar_conflicts_event_2_id_calendar_events_id_fk" FOREIGN KEY ("event_2_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_notifications" ADD CONSTRAINT "calendar_notifications_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_notifications" ADD CONSTRAINT "calendar_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_time_blocks" ADD CONSTRAINT "calendar_time_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_views_preferences" ADD CONSTRAINT "calendar_views_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_gap_logs" ADD CONSTRAINT "capability_gap_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_gap_logs" ADD CONSTRAINT "capability_gap_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_gap_logs" ADD CONSTRAINT "capability_gap_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_gap_logs" ADD CONSTRAINT "capability_gap_logs_learning_path_id_learning_paths_id_fk" FOREIGN KEY ("learning_path_id") REFERENCES "public"."learning_paths"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_history" ADD CONSTRAINT "capability_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_profiles" ADD CONSTRAINT "capability_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_profiles" ADD CONSTRAINT "capability_profiles_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_notification_preferences" ADD CONSTRAINT "channel_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_progression" ADD CONSTRAINT "character_progression_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_voice_messages" ADD CONSTRAINT "chat_voice_messages_message_id_personal_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."personal_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_voice_messages" ADD CONSTRAINT "chat_voice_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cognitive_load_scores" ADD CONSTRAINT "cognitive_load_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cognitive_load_scores" ADD CONSTRAINT "cognitive_load_scores_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_intelligence" ADD CONSTRAINT "competitor_intelligence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_records" ADD CONSTRAINT "condition_records_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_records" ADD CONSTRAINT "condition_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_signal_snapshot_id_signal_snapshots_id_fk" FOREIGN KEY ("signal_snapshot_id") REFERENCES "public"."signal_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_guidance" ADD CONSTRAINT "content_guidance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_guidance" ADD CONSTRAINT "content_guidance_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "continuous_task_guarantee_logs" ADD CONSTRAINT "continuous_task_guarantee_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "continuous_task_guarantee_logs" ADD CONSTRAINT "continuous_task_guarantee_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "continuous_task_guarantee_logs" ADD CONSTRAINT "continuous_task_guarantee_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradiction_records" ADD CONSTRAINT "contradiction_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contradiction_records" ADD CONSTRAINT "contradiction_records_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critic_review_logs" ADD CONSTRAINT "critic_review_logs_bhudhi_log_id_bhudhi_logs_id_fk" FOREIGN KEY ("bhudhi_log_id") REFERENCES "public"."bhudhi_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critic_review_logs" ADD CONSTRAINT "critic_review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_principle_records" ADD CONSTRAINT "daily_principle_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_principle_records" ADD CONSTRAINT "daily_principle_records_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_principle_records" ADD CONSTRAINT "daily_principle_records_application_id_principle_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."principle_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_intelligence_snapshots" ADD CONSTRAINT "dashboard_intelligence_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_logs" ADD CONSTRAINT "debate_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_traces" ADD CONSTRAINT "decision_traces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_traces" ADD CONSTRAINT "decision_traces_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "do_not_disturb_schedules" ADD CONSTRAINT "do_not_disturb_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_history" ADD CONSTRAINT "domain_history_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_history" ADD CONSTRAINT "domain_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_history" ADD CONSTRAINT "domain_history_trigger_event_id_events_id_fk" FOREIGN KEY ("trigger_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eis_call_logs" ADD CONSTRAINT "eis_call_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eis_call_logs" ADD CONSTRAINT "eis_call_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eis_call_logs" ADD CONSTRAINT "eis_call_logs_validation_id_validations_id_fk" FOREIGN KEY ("validation_id") REFERENCES "public"."validations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eis_rate_limits" ADD CONSTRAINT "eis_rate_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enforcement_packages" ADD CONSTRAINT "enforcement_packages_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enforcement_packages" ADD CONSTRAINT "enforcement_packages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_logs" ADD CONSTRAINT "escalation_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_logs" ADD CONSTRAINT "escalation_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_sessions" ADD CONSTRAINT "execution_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_sessions" ADD CONSTRAINT "execution_sessions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_intelligence" ADD CONSTRAINT "external_intelligence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_intelligence" ADD CONSTRAINT "external_intelligence_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_signals" ADD CONSTRAINT "external_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_signals" ADD CONSTRAINT "external_signals_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_classifications" ADD CONSTRAINT "failure_classifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_classifications" ADD CONSTRAINT "failure_classifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_classifications" ADD CONSTRAINT "failure_classifications_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fallback_usage_logs" ADD CONSTRAINT "fallback_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fallback_usage_logs" ADD CONSTRAINT "fallback_usage_logs_bhudhi_log_id_bhudhi_logs_id_fk" FOREIGN KEY ("bhudhi_log_id") REFERENCES "public"."bhudhi_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "false_progress_flags" ADD CONSTRAINT "false_progress_flags_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "false_progress_flags" ADD CONSTRAINT "false_progress_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "false_progress_flags" ADD CONSTRAINT "false_progress_flags_resolution_task_id_orders_id_fk" FOREIGN KEY ("resolution_task_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework_activations" ADD CONSTRAINT "framework_activations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework_activations" ADD CONSTRAINT "framework_activations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework_activations" ADD CONSTRAINT "framework_activations_signal_snapshot_id_signal_snapshots_id_fk" FOREIGN KEY ("signal_snapshot_id") REFERENCES "public"."signal_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework_decisions" ADD CONSTRAINT "framework_decisions_activation_id_framework_activations_id_fk" FOREIGN KEY ("activation_id") REFERENCES "public"."framework_activations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework_decisions" ADD CONSTRAINT "framework_decisions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework_signal_snapshots" ADD CONSTRAINT "framework_signal_snapshots_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framework_signal_snapshots" ADD CONSTRAINT "framework_signal_snapshots_signal_snapshot_id_signal_snapshots_id_fk" FOREIGN KEY ("signal_snapshot_id") REFERENCES "public"."signal_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_queue" ADD CONSTRAINT "governance_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "governance_queue" ADD CONSTRAINT "governance_queue_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checkins" ADD CONSTRAINT "habit_checkins_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checkins" ADD CONSTRAINT "habit_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checkins" ADD CONSTRAINT "habit_checkins_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_history" ADD CONSTRAINT "identity_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inactivity_records" ADD CONSTRAINT "inactivity_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inactivity_records" ADD CONSTRAINT "inactivity_records_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inactivity_records" ADD CONSTRAINT "inactivity_records_response_event_id_events_id_fk" FOREIGN KEY ("response_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inactivity_records" ADD CONSTRAINT "inactivity_records_recovery_task_id_orders_id_fk" FOREIGN KEY ("recovery_task_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_objects" ADD CONSTRAINT "knowledge_objects_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_objects" ADD CONSTRAINT "knowledge_objects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_personal_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."personal_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_search_index" ADD CONSTRAINT "message_search_index_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_search_index" ADD CONSTRAINT "message_search_index_message_id_personal_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."personal_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_device_tokens" ADD CONSTRAINT "mobile_device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_health_metrics" ADD CONSTRAINT "mobile_health_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_sync_log" ADD CONSTRAINT "mobile_sync_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_wearable_connections" ADD CONSTRAINT "mobile_wearable_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morning_reports" ADD CONSTRAINT "morning_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morning_reports" ADD CONSTRAINT "morning_reports_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_intelligence" ADD CONSTRAINT "narrative_intelligence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_history" ADD CONSTRAINT "notification_delivery_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_history" ADD CONSTRAINT "notification_delivery_history_queue_id_notification_delivery_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."notification_delivery_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_queue" ADD CONSTRAINT "notification_delivery_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dependencies" ADD CONSTRAINT "order_dependencies_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dependencies" ADD CONSTRAINT "order_dependencies_blocking_order_id_orders_id_fk" FOREIGN KEY ("blocking_order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_dependencies" ADD CONSTRAINT "order_dependencies_blocked_order_id_orders_id_fk" FOREIGN KEY ("blocked_order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_knowledge_links" ADD CONSTRAINT "order_knowledge_links_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_knowledge_links" ADD CONSTRAINT "order_knowledge_links_knowledge_id_knowledge_objects_id_fk" FOREIGN KEY ("knowledge_id") REFERENCES "public"."knowledge_objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_phase_id_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_linked_plan_id_plans_id_fk" FOREIGN KEY ("linked_plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_linked_season_id_seasons_id_fk" FOREIGN KEY ("linked_season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_linked_target_id_targets_id_fk" FOREIGN KEY ("linked_target_id") REFERENCES "public"."targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_linked_phase_id_phases_id_fk" FOREIGN KEY ("linked_phase_id") REFERENCES "public"."phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_linked_project_id_projects_id_fk" FOREIGN KEY ("linked_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_enforcement_package_id_enforcement_packages_id_fk" FOREIGN KEY ("enforcement_package_id") REFERENCES "public"."enforcement_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_member_id_users_id_fk" FOREIGN KEY ("assigned_member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_validation_records" ADD CONSTRAINT "outcome_validation_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_validation_records" ADD CONSTRAINT "outcome_validation_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_validation_records" ADD CONSTRAINT "outcome_validation_records_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_validations" ADD CONSTRAINT "outcome_validations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_validations" ADD CONSTRAINT "outcome_validations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_validations" ADD CONSTRAINT "outcome_validations_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_validations" ADD CONSTRAINT "outcome_validations_real_outcome_id_real_outcomes_id_fk" FOREIGN KEY ("real_outcome_id") REFERENCES "public"."real_outcomes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_records" ADD CONSTRAINT "pattern_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_messages" ADD CONSTRAINT "personal_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_messages" ADD CONSTRAINT "personal_messages_linked_order_id_orders_id_fk" FOREIGN KEY ("linked_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_checkpoints" ADD CONSTRAINT "phase_checkpoints_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_checkpoints" ADD CONSTRAINT "phase_checkpoints_phase_id_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_checkpoints" ADD CONSTRAINT "phase_checkpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pivot_reviews" ADD CONSTRAINT "pivot_reviews_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pivot_reviews" ADD CONSTRAINT "pivot_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pivot_reviews" ADD CONSTRAINT "pivot_reviews_signal_snapshot_id_signal_snapshots_id_fk" FOREIGN KEY ("signal_snapshot_id") REFERENCES "public"."signal_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_logs" ADD CONSTRAINT "prediction_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_logs" ADD CONSTRAINT "prediction_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_snapshots" ADD CONSTRAINT "prediction_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_snapshots" ADD CONSTRAINT "prediction_snapshots_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_snapshots" ADD CONSTRAINT "prediction_snapshots_signal_snapshot_id_signal_snapshots_id_fk" FOREIGN KEY ("signal_snapshot_id") REFERENCES "public"."signal_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_applications" ADD CONSTRAINT "principle_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_applications" ADD CONSTRAINT "principle_applications_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_proof_uploads" ADD CONSTRAINT "principle_proof_uploads_application_id_principle_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."principle_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_selections" ADD CONSTRAINT "principle_selections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_selections" ADD CONSTRAINT "principle_selections_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_streaks" ADD CONSTRAINT "principle_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_dependencies" ADD CONSTRAINT "project_dependencies_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_dependencies" ADD CONSTRAINT "project_dependencies_blocking_project_id_projects_id_fk" FOREIGN KEY ("blocking_project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_dependencies" ADD CONSTRAINT "project_dependencies_blocked_project_id_projects_id_fk" FOREIGN KEY ("blocked_project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_phase_id_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_content" ADD CONSTRAINT "published_content_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_content" ADD CONSTRAINT "published_content_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_outcomes" ADD CONSTRAINT "real_outcomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_outcomes" ADD CONSTRAINT "real_outcomes_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_outcomes" ADD CONSTRAINT "real_outcomes_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_events" ADD CONSTRAINT "reward_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_snapshots" ADD CONSTRAINT "signal_snapshots_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_snapshots" ADD CONSTRAINT "signal_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_snapshots" ADD CONSTRAINT "signal_snapshots_causation_event_id_events_id_fk" FOREIGN KEY ("causation_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_profiles" ADD CONSTRAINT "skill_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stability_events" ADD CONSTRAINT "stability_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_memory" ADD CONSTRAINT "state_memory_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_memory" ADD CONSTRAINT "state_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_snapshots" ADD CONSTRAINT "status_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_assumptions" ADD CONSTRAINT "strategic_assumptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_assumptions" ADD CONSTRAINT "strategic_assumptions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_assumptions" ADD CONSTRAINT "strategic_assumptions_validation_id_validations_id_fk" FOREIGN KEY ("validation_id") REFERENCES "public"."validations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_outlook_records" ADD CONSTRAINT "strategic_outlook_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_health_logs" ADD CONSTRAINT "system_health_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_health_logs" ADD CONSTRAINT "system_health_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_generation_log" ADD CONSTRAINT "task_generation_log_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_generation_log" ADD CONSTRAINT "task_generation_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_generation_log" ADD CONSTRAINT "task_generation_log_enforcement_package_id_enforcement_packages_id_fk" FOREIGN KEY ("enforcement_package_id") REFERENCES "public"."enforcement_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_generation_log" ADD CONSTRAINT "task_generation_log_ai_log_id_bhudhi_logs_id_fk" FOREIGN KEY ("ai_log_id") REFERENCES "public"."bhudhi_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_generation_logs" ADD CONSTRAINT "task_generation_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_generation_logs" ADD CONSTRAINT "task_generation_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_intelligence" ADD CONSTRAINT "trend_intelligence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_current_avatar_template_id_avatar_templates_id_fk" FOREIGN KEY ("current_avatar_template_id") REFERENCES "public"."avatar_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_gamification_profile" ADD CONSTRAINT "user_gamification_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identity_states" ADD CONSTRAINT "user_identity_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identity_states" ADD CONSTRAINT "user_identity_states_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_levels" ADD CONSTRAINT "user_levels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_channels" ADD CONSTRAINT "user_notification_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_principle_profiles" ADD CONSTRAINT "user_principle_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_social_accounts" ADD CONSTRAINT "user_social_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_archetype_maps" ADD CONSTRAINT "validation_archetype_maps_validation_id_validations_id_fk" FOREIGN KEY ("validation_id") REFERENCES "public"."validations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_archetype_maps" ADD CONSTRAINT "validation_archetype_maps_archetype_id_economic_archetypes_id_fk" FOREIGN KEY ("archetype_id") REFERENCES "public"."economic_archetypes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_event_logs" ADD CONSTRAINT "validation_event_logs_validation_id_validations_id_fk" FOREIGN KEY ("validation_id") REFERENCES "public"."validations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_event_logs" ADD CONSTRAINT "validation_event_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_event_logs" ADD CONSTRAINT "validation_event_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_memory" ADD CONSTRAINT "validation_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_memory" ADD CONSTRAINT "validation_memory_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_memory" ADD CONSTRAINT "validation_memory_validation_id_validations_id_fk" FOREIGN KEY ("validation_id") REFERENCES "public"."validations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validations" ADD CONSTRAINT "validations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validations" ADD CONSTRAINT "validations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdict_evolution" ADD CONSTRAINT "verdict_evolution_validation_id_validations_id_fk" FOREIGN KEY ("validation_id") REFERENCES "public"."validations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdict_evolution" ADD CONSTRAINT "verdict_evolution_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdict_evolution" ADD CONSTRAINT "verdict_evolution_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_models" ADD CONSTRAINT "world_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_analytics" ADD CONSTRAINT "academy_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_insights" ADD CONSTRAINT "analytics_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_analytics" ADD CONSTRAINT "content_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_insights" ADD CONSTRAINT "content_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_analytics" ADD CONSTRAINT "execution_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_benchmarks" ADD CONSTRAINT "execution_benchmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_patterns" ADD CONSTRAINT "execution_patterns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_velocity" ADD CONSTRAINT "execution_velocity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_analysis" ADD CONSTRAINT "failure_analysis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_analysis" ADD CONSTRAINT "failure_analysis_failed_order_id_orders_id_fk" FOREIGN KEY ("failed_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_velocity_analytics" ADD CONSTRAINT "learning_velocity_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_performance" ADD CONSTRAINT "platform_performance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_performance" ADD CONSTRAINT "post_performance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_performance" ADD CONSTRAINT "post_performance_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_analytics" ADD CONSTRAINT "principle_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_analytics" ADD CONSTRAINT "principle_analytics_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_effectiveness" ADD CONSTRAINT "principle_effectiveness_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_effectiveness" ADD CONSTRAINT "principle_effectiveness_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_insights" ADD CONSTRAINT "principle_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_insights" ADD CONSTRAINT "principle_insights_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productivity_heatmap" ADD CONSTRAINT "productivity_heatmap_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weak_areas_detected" ADD CONSTRAINT "weak_areas_detected_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_flows" ADD CONSTRAINT "automation_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_conflicts_external" ADD CONSTRAINT "calendar_conflicts_external_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_conflicts_external" ADD CONSTRAINT "calendar_conflicts_external_torgima_event_id_calendar_events_id_fk" FOREIGN KEY ("torgima_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_log" ADD CONSTRAINT "calendar_sync_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_log" ADD CONSTRAINT "calendar_sync_log_integration_id_external_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."external_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_sync_log" ADD CONSTRAINT "engagement_sync_log_social_post_mapping_id_social_post_mappings_id_fk" FOREIGN KEY ("social_post_mapping_id") REFERENCES "public"."social_post_mappings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_integrations" ADD CONSTRAINT "external_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_data_sync_log" ADD CONSTRAINT "health_data_sync_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_data_sync_log" ADD CONSTRAINT "health_data_sync_log_integration_id_external_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."external_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhook_logs" ADD CONSTRAINT "integration_webhook_logs_webhook_id_integration_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."integration_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_webhooks" ADD CONSTRAINT "integration_webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_mappings" ADD CONSTRAINT "social_post_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_mappings" ADD CONSTRAINT "social_post_mappings_published_content_id_published_content_id_fk" FOREIGN KEY ("published_content_id") REFERENCES "public"."published_content"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zapier_connections" ADD CONSTRAINT "zapier_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountability_pledges" ADD CONSTRAINT "accountability_pledges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_social_links" ADD CONSTRAINT "profile_social_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_widgets" ADD CONSTRAINT "profile_widgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profile_views" ADD CONSTRAINT "public_profile_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profile_views" ADD CONSTRAINT "public_profile_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shareable_daily_entries" ADD CONSTRAINT "shareable_daily_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shareable_daily_entries" ADD CONSTRAINT "shareable_daily_entries_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shareable_daily_entries" ADD CONSTRAINT "shareable_daily_entries_daily_record_id_daily_principle_records_id_fk" FOREIGN KEY ("daily_record_id") REFERENCES "public"."daily_principle_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_belief_conflicts" ADD CONSTRAINT "bhudhi_belief_conflicts_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_belief_conflicts" ADD CONSTRAINT "bhudhi_belief_conflicts_belief_id_a_bhudhi_belief_records_id_fk" FOREIGN KEY ("belief_id_a") REFERENCES "public"."bhudhi_belief_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_belief_conflicts" ADD CONSTRAINT "bhudhi_belief_conflicts_belief_id_b_bhudhi_belief_records_id_fk" FOREIGN KEY ("belief_id_b") REFERENCES "public"."bhudhi_belief_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_belief_evidence" ADD CONSTRAINT "bhudhi_belief_evidence_belief_id_bhudhi_belief_records_id_fk" FOREIGN KEY ("belief_id") REFERENCES "public"."bhudhi_belief_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_belief_history" ADD CONSTRAINT "bhudhi_belief_history_belief_id_bhudhi_belief_records_id_fk" FOREIGN KEY ("belief_id") REFERENCES "public"."bhudhi_belief_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_belief_records" ADD CONSTRAINT "bhudhi_belief_records_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_belief_truth" ADD CONSTRAINT "bhudhi_belief_truth_belief_id_bhudhi_belief_records_id_fk" FOREIGN KEY ("belief_id") REFERENCES "public"."bhudhi_belief_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_civilization_events" ADD CONSTRAINT "bhudhi_civilization_events_civilization_id_bhudhi_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."bhudhi_civilizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_civilization_forecasts" ADD CONSTRAINT "bhudhi_civilization_forecasts_civilization_id_bhudhi_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."bhudhi_civilizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_civilization_memory" ADD CONSTRAINT "bhudhi_civilization_memory_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_civilization_memory" ADD CONSTRAINT "bhudhi_civilization_memory_civilization_id_bhudhi_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."bhudhi_civilizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_civilization_states" ADD CONSTRAINT "bhudhi_civilization_states_civilization_id_bhudhi_civilizations_id_fk" FOREIGN KEY ("civilization_id") REFERENCES "public"."bhudhi_civilizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_civilizations" ADD CONSTRAINT "bhudhi_civilizations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_context_states" ADD CONSTRAINT "bhudhi_context_states_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_decision_forecasts" ADD CONSTRAINT "bhudhi_decision_forecasts_decision_id_bhudhi_decision_records_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."bhudhi_decision_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_decision_options" ADD CONSTRAINT "bhudhi_decision_options_decision_id_bhudhi_decision_records_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."bhudhi_decision_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_decision_records" ADD CONSTRAINT "bhudhi_decision_records_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_decision_replay" ADD CONSTRAINT "bhudhi_decision_replay_decision_id_bhudhi_decision_records_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."bhudhi_decision_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_decision_scores" ADD CONSTRAINT "bhudhi_decision_scores_decision_id_bhudhi_decision_records_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."bhudhi_decision_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_economics_forecasts" ADD CONSTRAINT "bhudhi_economics_forecasts_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_economics_logs" ADD CONSTRAINT "bhudhi_economics_logs_session_id_bhudhi_economics_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."bhudhi_economics_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_economics_profiles" ADD CONSTRAINT "bhudhi_economics_profiles_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_economics_sessions" ADD CONSTRAINT "bhudhi_economics_sessions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_engines" ADD CONSTRAINT "bhudhi_engines_system_id_bhudhi_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."bhudhi_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_execution_contracts" ADD CONSTRAINT "bhudhi_execution_contracts_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_execution_events" ADD CONSTRAINT "bhudhi_execution_events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_execution_plans" ADD CONSTRAINT "bhudhi_execution_plans_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_expansion_benchmarks" ADD CONSTRAINT "bhudhi_expansion_benchmarks_capability_id_bhudhi_expansion_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."bhudhi_expansion_capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_expansion_capabilities" ADD CONSTRAINT "bhudhi_expansion_capabilities_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_expansion_events" ADD CONSTRAINT "bhudhi_expansion_events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_expansion_events" ADD CONSTRAINT "bhudhi_expansion_events_capability_id_bhudhi_expansion_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."bhudhi_expansion_capabilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_expansion_history" ADD CONSTRAINT "bhudhi_expansion_history_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_expansion_memory" ADD CONSTRAINT "bhudhi_expansion_memory_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_experiment_groups" ADD CONSTRAINT "bhudhi_experiment_groups_experiment_id_bhudhi_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."bhudhi_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_experiment_memory" ADD CONSTRAINT "bhudhi_experiment_memory_experiment_id_bhudhi_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."bhudhi_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_experiment_promotions" ADD CONSTRAINT "bhudhi_experiment_promotions_experiment_id_bhudhi_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."bhudhi_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_experiment_promotions" ADD CONSTRAINT "bhudhi_experiment_promotions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_experiment_results" ADD CONSTRAINT "bhudhi_experiment_results_experiment_id_bhudhi_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."bhudhi_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_experiment_results" ADD CONSTRAINT "bhudhi_experiment_results_group_id_bhudhi_experiment_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."bhudhi_experiment_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_experiments" ADD CONSTRAINT "bhudhi_experiments_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_external_connections" ADD CONSTRAINT "bhudhi_external_connections_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_external_data" ADD CONSTRAINT "bhudhi_external_data_connection_id_bhudhi_external_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bhudhi_external_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_framework_learning" ADD CONSTRAINT "bhudhi_framework_learning_framework_id_bhudhi_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."bhudhi_frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_governance_approvals" ADD CONSTRAINT "bhudhi_governance_approvals_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_governance_audit" ADD CONSTRAINT "bhudhi_governance_audit_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_governance_emergency" ADD CONSTRAINT "bhudhi_governance_emergency_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_governance_memory" ADD CONSTRAINT "bhudhi_governance_memory_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_governance_violations" ADD CONSTRAINT "bhudhi_governance_violations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_governor_allocations" ADD CONSTRAINT "bhudhi_governor_allocations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_governor_events" ADD CONSTRAINT "bhudhi_governor_events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_governor_health" ADD CONSTRAINT "bhudhi_governor_health_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_governor_history" ADD CONSTRAINT "bhudhi_governor_history_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_governor_recovery" ADD CONSTRAINT "bhudhi_governor_recovery_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_idea_sets" ADD CONSTRAINT "bhudhi_idea_sets_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_identity_events" ADD CONSTRAINT "bhudhi_identity_events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_identity_events" ADD CONSTRAINT "bhudhi_identity_events_profile_id_bhudhi_identity_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."bhudhi_identity_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_identity_growth" ADD CONSTRAINT "bhudhi_identity_growth_profile_id_bhudhi_identity_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."bhudhi_identity_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_identity_history" ADD CONSTRAINT "bhudhi_identity_history_profile_id_bhudhi_identity_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."bhudhi_identity_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_identity_profiles" ADD CONSTRAINT "bhudhi_identity_profiles_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_identity_values" ADD CONSTRAINT "bhudhi_identity_values_profile_id_bhudhi_identity_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."bhudhi_identity_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_incident_logs" ADD CONSTRAINT "bhudhi_incident_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_infra_capacity" ADD CONSTRAINT "bhudhi_infra_capacity_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_infra_deployments" ADD CONSTRAINT "bhudhi_infra_deployments_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_infra_events" ADD CONSTRAINT "bhudhi_infra_events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_infra_health" ADD CONSTRAINT "bhudhi_infra_health_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_infra_runtime" ADD CONSTRAINT "bhudhi_infra_runtime_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_investigations" ADD CONSTRAINT "bhudhi_investigations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_investigations" ADD CONSTRAINT "bhudhi_investigations_engine_id_bhudhi_engines_id_fk" FOREIGN KEY ("engine_id") REFERENCES "public"."bhudhi_engines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_kernel_events" ADD CONSTRAINT "bhudhi_kernel_events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory_edges" ADD CONSTRAINT "bhudhi_memory_edges_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory_edges" ADD CONSTRAINT "bhudhi_memory_edges_from_node_id_bhudhi_memory_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."bhudhi_memory_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory_edges" ADD CONSTRAINT "bhudhi_memory_edges_to_node_id_bhudhi_memory_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."bhudhi_memory_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory_nodes" ADD CONSTRAINT "bhudhi_memory_nodes_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory_queries" ADD CONSTRAINT "bhudhi_memory_queries_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory_relationships" ADD CONSTRAINT "bhudhi_memory_relationships_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory_relationships" ADD CONSTRAINT "bhudhi_memory_relationships_node_id_1_bhudhi_memory_nodes_id_fk" FOREIGN KEY ("node_id_1") REFERENCES "public"."bhudhi_memory_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory_relationships" ADD CONSTRAINT "bhudhi_memory_relationships_node_id_2_bhudhi_memory_nodes_id_fk" FOREIGN KEY ("node_id_2") REFERENCES "public"."bhudhi_memory_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory_timeline" ADD CONSTRAINT "bhudhi_memory_timeline_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_memory_timeline" ADD CONSTRAINT "bhudhi_memory_timeline_node_id_bhudhi_memory_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."bhudhi_memory_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_organization_events" ADD CONSTRAINT "bhudhi_organization_events_organization_id_bhudhi_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."bhudhi_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_organization_events" ADD CONSTRAINT "bhudhi_organization_events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_organization_health" ADD CONSTRAINT "bhudhi_organization_health_organization_id_bhudhi_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."bhudhi_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_organization_memory" ADD CONSTRAINT "bhudhi_organization_memory_organization_id_bhudhi_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."bhudhi_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_organization_roles" ADD CONSTRAINT "bhudhi_organization_roles_organization_id_bhudhi_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."bhudhi_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_organizations" ADD CONSTRAINT "bhudhi_organizations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_permission_history" ADD CONSTRAINT "bhudhi_permission_history_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_predictions" ADD CONSTRAINT "bhudhi_predictions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_protocol_messages" ADD CONSTRAINT "bhudhi_protocol_messages_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_recommendations" ADD CONSTRAINT "bhudhi_recommendations_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_recommendations" ADD CONSTRAINT "bhudhi_recommendations_engine_id_bhudhi_engines_id_fk" FOREIGN KEY ("engine_id") REFERENCES "public"."bhudhi_engines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_recovery_records" ADD CONSTRAINT "bhudhi_recovery_records_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_reliability_events" ADD CONSTRAINT "bhudhi_reliability_events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_rollback_history" ADD CONSTRAINT "bhudhi_rollback_history_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_secret_registry" ADD CONSTRAINT "bhudhi_secret_registry_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_security_events" ADD CONSTRAINT "bhudhi_security_events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_shared_context" ADD CONSTRAINT "bhudhi_shared_context_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_signals" ADD CONSTRAINT "bhudhi_signals_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_simulation_events" ADD CONSTRAINT "bhudhi_simulation_events_run_id_bhudhi_simulation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."bhudhi_simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_simulation_memory" ADD CONSTRAINT "bhudhi_simulation_memory_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_simulation_runs" ADD CONSTRAINT "bhudhi_simulation_runs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_simulation_runs" ADD CONSTRAINT "bhudhi_simulation_runs_world_id_bhudhi_simulation_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."bhudhi_simulation_worlds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_simulation_scores" ADD CONSTRAINT "bhudhi_simulation_scores_run_id_bhudhi_simulation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."bhudhi_simulation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_simulation_worlds" ADD CONSTRAINT "bhudhi_simulation_worlds_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_strategic_choices" ADD CONSTRAINT "bhudhi_strategic_choices_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_system_health" ADD CONSTRAINT "bhudhi_system_health_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_team_alignment" ADD CONSTRAINT "bhudhi_team_alignment_team_id_bhudhi_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bhudhi_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_team_health" ADD CONSTRAINT "bhudhi_team_health_team_id_bhudhi_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bhudhi_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_team_identity" ADD CONSTRAINT "bhudhi_team_identity_team_id_bhudhi_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bhudhi_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_team_memory" ADD CONSTRAINT "bhudhi_team_memory_team_id_bhudhi_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."bhudhi_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_teams" ADD CONSTRAINT "bhudhi_teams_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_temporal_forecasts" ADD CONSTRAINT "bhudhi_temporal_forecasts_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_temporal_history" ADD CONSTRAINT "bhudhi_temporal_history_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_temporal_patterns" ADD CONSTRAINT "bhudhi_temporal_patterns_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_temporal_timelines" ADD CONSTRAINT "bhudhi_temporal_timelines_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_temporal_windows" ADD CONSTRAINT "bhudhi_temporal_windows_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_threat_records" ADD CONSTRAINT "bhudhi_threat_records_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_trust_profiles" ADD CONSTRAINT "bhudhi_trust_profiles_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_unified_execution_contexts" ADD CONSTRAINT "bhudhi_unified_execution_contexts_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_world_entities" ADD CONSTRAINT "bhudhi_world_entities_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_world_events" ADD CONSTRAINT "bhudhi_world_events_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_world_events" ADD CONSTRAINT "bhudhi_world_events_entity_id_bhudhi_world_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."bhudhi_world_entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_world_relationships" ADD CONSTRAINT "bhudhi_world_relationships_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_world_relationships" ADD CONSTRAINT "bhudhi_world_relationships_from_entity_id_bhudhi_world_entities_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."bhudhi_world_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_world_relationships" ADD CONSTRAINT "bhudhi_world_relationships_to_entity_id_bhudhi_world_entities_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."bhudhi_world_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_world_snapshots" ADD CONSTRAINT "bhudhi_world_snapshots_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_world_states" ADD CONSTRAINT "bhudhi_world_states_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bhudhi_world_states" ADD CONSTRAINT "bhudhi_world_states_entity_id_bhudhi_world_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."bhudhi_world_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_sequence_history" ADD CONSTRAINT "blueprint_sequence_history_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_sequences" ADD CONSTRAINT "blueprint_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_tier_sequences" ADD CONSTRAINT "blueprint_tier_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_sequences" ADD CONSTRAINT "context_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_feedback_sequences" ADD CONSTRAINT "execution_feedback_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_structure_sequences" ADD CONSTRAINT "execution_structure_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_sequences" ADD CONSTRAINT "goal_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_plan_sequences" ADD CONSTRAINT "master_plan_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mini_plan_allocation_history" ADD CONSTRAINT "mini_plan_allocation_history_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mini_plan_sequences" ADD CONSTRAINT "mini_plan_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_sequences" ADD CONSTRAINT "policy_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_scene_sequences" ADD CONSTRAINT "prediction_scene_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purpose_sequences" ADD CONSTRAINT "purpose_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_flows" ADD CONSTRAINT "sequence_flows_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_condition_sequences" ADD CONSTRAINT "signal_condition_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_sequences" ADD CONSTRAINT "signal_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_generation_sequences" ADD CONSTRAINT "task_generation_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_result_sequences" ADD CONSTRAINT "validation_result_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_sequences" ADD CONSTRAINT "validation_sequences_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adaptation_suggestions" ADD CONSTRAINT "adaptation_suggestions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_execution_patterns" ADD CONSTRAINT "growth_execution_patterns_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interrogation_logs" ADD CONSTRAINT "interrogation_logs_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_cards" ADD CONSTRAINT "knowledge_cards_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ultimate_emergency_orders" ADD CONSTRAINT "ultimate_emergency_orders_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ultimate_predictions" ADD CONSTRAINT "ultimate_predictions_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ultimate_scenes" ADD CONSTRAINT "ultimate_scenes_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ultimate_validation_checkpoints" ADD CONSTRAINT "ultimate_validation_checkpoints_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_academy_chapter_course_num" ON "academy_chapters" USING btree ("course_id","chapter_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_academy_concept_mastery_user_concept" ON "academy_concept_mastery" USING btree ("user_id","concept_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_academy_lesson_chapter_num" ON "academy_lessons" USING btree ("chapter_id","lesson_number");--> statement-breakpoint
CREATE INDEX "idx_academy_practice_items_lesson" ON "academy_practice_items" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_academy_proof_task_id" ON "academy_proof" USING btree ("academy_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_academy_retention_user_lesson" ON "academy_retention_data" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_academy_roadmap_goal_step" ON "academy_roadmap_steps" USING btree ("learning_goal_id","step_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_academy_enrollment_user_course" ON "academy_student_enrollments" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "idx_academy_study_sessions_user_date" ON "academy_study_sessions" USING btree ("user_id","session_date");--> statement-breakpoint
CREATE INDEX "idx_academy_tasks_blueprint_id" ON "academy_tasks" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_academy_tasks_status" ON "academy_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_actions_blueprint_id" ON "actions" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_actions_project_id" ON "actions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_active_feedback_sessions_blueprint_date" ON "active_feedback_sessions" USING btree ("blueprint_id","session_date");--> statement-breakpoint
CREATE INDEX "idx_active_feedback_sessions_user_blueprint" ON "active_feedback_sessions" USING btree ("user_id","blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_agent_conflict_logs_user_id" ON "agent_conflict_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_behavior_events_user_id" ON "behavior_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_behavior_events_pattern_id" ON "behavior_events" USING btree ("pattern_id");--> statement-breakpoint
CREATE INDEX "idx_behavior_patterns_user_id" ON "behavior_patterns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_behavior_patterns_status" ON "behavior_patterns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_behavioral_insights_user_seen" ON "behavioral_insight_records" USING btree ("user_id","seen","dismissed");--> statement-breakpoint
CREATE INDEX "idx_behavioral_insights_created" ON "behavioral_insight_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_logs_user_id" ON "bhudhi_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_logs_blueprint_id" ON "bhudhi_logs" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_logs_request_type" ON "bhudhi_logs" USING btree ("request_type");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_user_id" ON "bhudhi_memory" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_user_type" ON "bhudhi_memory" USING btree ("user_id","memory_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bhudhi_budget_user_date" ON "bhudhi_usage_budget" USING btree ("user_id","date_utc");--> statement-breakpoint
CREATE INDEX "idx_blocker_logs_user_status" ON "blocker_logs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_blueprint_framework_signals_blueprint" ON "blueprint_framework_signals" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blueprint_framework_signal" ON "blueprint_framework_signals" USING btree ("blueprint_id","signal_key");--> statement-breakpoint
CREATE INDEX "idx_blueprint_health_records_blueprint_id" ON "blueprint_health_records" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_blueprint_interpretations_blueprint_id" ON "blueprint_interpretations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_blueprint_members_blueprint_id" ON "blueprint_members" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_blueprint_members_user_id" ON "blueprint_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_blueprint_mutations_blueprint_id" ON "blueprint_mutations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_blueprint_policies_blueprint_id" ON "blueprint_policies" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_blueprint_policies_blueprint_active" ON "blueprint_policies" USING btree ("blueprint_id","active");--> statement-breakpoint
CREATE INDEX "idx_blueprint_tier_migrations_blueprint_id" ON "blueprint_tier_migrations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_blueprint_versions_blueprint_id" ON "blueprint_versions" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_blueprints_user_id" ON "blueprints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_blueprints_status" ON "blueprints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_burnout_records_user_created" ON "burnout_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_calendar_conflicts_user" ON "calendar_conflicts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_calendar_event_user_source" ON "calendar_events" USING btree ("user_id","source_id","source_type");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_user_start" ON "calendar_events" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_user_status" ON "calendar_events" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_calendar_notifications_due" ON "calendar_notifications" USING btree ("scheduled_send_at");--> statement-breakpoint
CREATE INDEX "idx_calendar_time_blocks_user" ON "calendar_time_blocks" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "idx_capability_gap_logs_user_resolved" ON "capability_gap_logs" USING btree ("user_id","resolved");--> statement-breakpoint
CREATE INDEX "idx_capability_history_user_id" ON "capability_history" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_channel_notification_pref" ON "channel_notification_preferences" USING btree ("user_id","channel_type","notification_type");--> statement-breakpoint
CREATE INDEX "idx_character_progression_user_id" ON "character_progression" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cognitive_load_scores_user_id" ON "cognitive_load_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cognitive_load_scores_blueprint_id" ON "cognitive_load_scores" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_competitor_intelligence_user_created" ON "competitor_intelligence" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_competitor_intelligence_expires" ON "competitor_intelligence" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_condition_records_blueprint_id" ON "condition_records" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_condition_records_blueprint_current" ON "condition_records" USING btree ("blueprint_id","is_current");--> statement-breakpoint
CREATE INDEX "idx_conditions_blueprint_id" ON "conditions" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_conditions_blueprint_current" ON "conditions" USING btree ("blueprint_id","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_content_guidance_user_date" ON "content_guidance" USING btree ("user_id","guidance_date");--> statement-breakpoint
CREATE INDEX "idx_continuous_task_guarantee_logs_user" ON "continuous_task_guarantee_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_contradiction_records_blueprint_id" ON "contradiction_records" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_contradiction_records_user_id" ON "contradiction_records" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_critic_review_logs_bhudhi_log_id" ON "critic_review_logs" USING btree ("bhudhi_log_id");--> statement-breakpoint
CREATE INDEX "idx_critic_review_logs_user_id" ON "critic_review_logs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_daily_principle_record_user_date" ON "daily_principle_records" USING btree ("user_id","principle_date");--> statement-breakpoint
CREATE INDEX "idx_daily_principle_records_user_date" ON "daily_principle_records" USING btree ("user_id","principle_date");--> statement-breakpoint
CREATE INDEX "idx_dashboard_intelligence_user" ON "dashboard_intelligence_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dead_letter_event_type" ON "dead_letter_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_dead_letter_resolved" ON "dead_letter_events" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "idx_debate_logs_user_id" ON "debate_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_decision_traces_blueprint_id" ON "decision_traces" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_decision_traces_decision_type" ON "decision_traces" USING btree ("decision_type");--> statement-breakpoint
CREATE INDEX "idx_domain_history_blueprint_id" ON "domain_history" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_domain_history_blueprint_current" ON "domain_history" USING btree ("blueprint_id","is_current");--> statement-breakpoint
CREATE INDEX "idx_economic_archetypes_number" ON "economic_archetypes" USING btree ("archetype_number");--> statement-breakpoint
CREATE INDEX "idx_eis_call_logs_user_id" ON "eis_call_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_eis_call_logs_created_at" ON "eis_call_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_eis_rate_limits_user_industry" ON "eis_rate_limits" USING btree ("user_id","industry","niche");--> statement-breakpoint
CREATE INDEX "idx_enforcement_packages_blueprint_id" ON "enforcement_packages" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_enforcement_packages_blueprint_current" ON "enforcement_packages" USING btree ("blueprint_id","is_current");--> statement-breakpoint
CREATE INDEX "idx_escalation_logs_blueprint_id" ON "escalation_logs" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_event_logs_event_id" ON "event_logs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_events_event_type" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_events_blueprint_id" ON "events" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_execution_sessions_user_id" ON "execution_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_execution_sessions_blueprint_id" ON "execution_sessions" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_external_intelligence_blueprint" ON "external_intelligence" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_external_intelligence_expires" ON "external_intelligence" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_external_signals_user_id" ON "external_signals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_external_signals_blueprint_id" ON "external_signals" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_external_signals_source_name" ON "external_signals" USING btree ("source_name");--> statement-breakpoint
CREATE INDEX "idx_external_signals_status" ON "external_signals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_failure_classifications_feedback" ON "failure_classifications" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "idx_fallback_usage_logs_created_at" ON "fallback_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_false_progress_flags_blueprint_id" ON "false_progress_flags" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_false_progress_flags_resolved" ON "false_progress_flags" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "idx_feedback_order_id" ON "feedback" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_blueprint_id" ON "feedback" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_blueprint_created_at" ON "feedback" USING btree ("blueprint_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_feedback_user_id" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_framework_activations_blueprint_id" ON "framework_activations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_framework_decisions_blueprint_id" ON "framework_decisions" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_framework_decisions_status" ON "framework_decisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_framework_signal_snapshots_blueprint_id" ON "framework_signal_snapshots" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_governance_queue_blueprint_id" ON "governance_queue" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_governance_queue_status" ON "governance_queue" USING btree ("blueprint_id","status");--> statement-breakpoint
CREATE INDEX "idx_habit_checkins_habit_id" ON "habit_checkins" USING btree ("habit_id");--> statement-breakpoint
CREATE INDEX "idx_habits_blueprint_id" ON "habits" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_idempotency_records_expires_at" ON "idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_idempotency_records_key" ON "idempotency_records" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_identity_history_user_id" ON "identity_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_identity_profiles_user_id" ON "identity_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_in_app_notifications_user" ON "in_app_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inactivity_records_user_id" ON "inactivity_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inactivity_records_blueprint_resolved" ON "inactivity_records" USING btree ("blueprint_id","resolved");--> statement-breakpoint
CREATE INDEX "idx_knowledge_objects_domain" ON "knowledge_objects" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_knowledge_objects_type" ON "knowledge_objects" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_knowledge_packages_domain_action" ON "knowledge_packages" USING btree ("domain","action_type");--> statement-breakpoint
CREATE INDEX "idx_learning_paths_user_status" ON "learning_paths" USING btree ("user_id","path_status");--> statement-breakpoint
CREATE INDEX "idx_magic_link_tokens_user_id" ON "magic_link_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_magic_link_tokens_email" ON "magic_link_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_message_search_user" ON "message_search_index" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_milestones_user_id" ON "milestones" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_milestones_blueprint_id" ON "milestones" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_mobile_device_token" ON "mobile_device_tokens" USING btree ("user_id","push_token");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_mobile_health_day" ON "mobile_health_metrics" USING btree ("user_id","metric_date","source");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_mobile_sync_action" ON "mobile_sync_log" USING btree ("user_id","client_action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_mobile_wearable" ON "mobile_wearable_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "idx_morning_reports_user_id" ON "morning_reports" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_morning_reports_user_date" ON "morning_reports" USING btree ("user_id","report_date");--> statement-breakpoint
CREATE INDEX "idx_narrative_intelligence_user_created" ON "narrative_intelligence" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_narrative_intelligence_expires" ON "narrative_intelligence" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_notification_delivery_queue_due" ON "notification_delivery_queue" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_user_id" ON "notification_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_status" ON "notification_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_type" ON "notification_logs" USING btree ("notification_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_order_dependency" ON "order_dependencies" USING btree ("blocking_order_id","blocked_order_id");--> statement-breakpoint
CREATE INDEX "idx_order_dependencies_blocked_status" ON "order_dependencies" USING btree ("blocked_order_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_order_knowledge" ON "order_knowledge_links" USING btree ("order_id","knowledge_id");--> statement-breakpoint
CREATE INDEX "idx_orders_blueprint_id" ON "orders" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_orders_action_id" ON "orders" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_orders_blueprint_status" ON "orders" USING btree ("blueprint_id","status");--> statement-breakpoint
CREATE INDEX "idx_outcome_validation_records_feedback" ON "outcome_validation_records" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "idx_outcome_validations_blueprint_id" ON "outcome_validations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_outcome_validations_validation_result" ON "outcome_validations" USING btree ("blueprint_id","validation_result");--> statement-breakpoint
CREATE INDEX "idx_pattern_records_user_active" ON "pattern_records" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_personal_messages_user_created" ON "personal_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_phase_checkpoints_blueprint_id" ON "phase_checkpoints" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_phases_blueprint_id" ON "phases" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_phases_status" ON "phases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pivot_reviews_blueprint_id" ON "pivot_reviews" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_pivot_reviews_status" ON "pivot_reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_plans_blueprint_id" ON "plans" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_platform_algorithm_signals_platform" ON "platform_algorithm_signals" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_platform_algorithm_signals_valid_until" ON "platform_algorithm_signals" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX "idx_prediction_logs_user_id" ON "prediction_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_prediction_snapshots_blueprint" ON "prediction_snapshots" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_principle_application_user_date" ON "principle_applications" USING btree ("user_id","principle_date");--> statement-breakpoint
CREATE INDEX "idx_principle_applications_user_date" ON "principle_applications" USING btree ("user_id","principle_date");--> statement-breakpoint
CREATE INDEX "idx_principle_proof_uploads_application" ON "principle_proof_uploads" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_principle_selection_user_date" ON "principle_selections" USING btree ("user_id","selected_date");--> statement-breakpoint
CREATE INDEX "idx_principle_selections_user_date" ON "principle_selections" USING btree ("user_id","selected_date");--> statement-breakpoint
CREATE INDEX "idx_principles_day_number" ON "principles" USING btree ("day_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_project_dependency" ON "project_dependencies" USING btree ("blocking_project_id","blocked_project_id");--> statement-breakpoint
CREATE INDEX "idx_projects_blueprint_id" ON "projects" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_real_outcomes_blueprint_id" ON "real_outcomes" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_reward_events_user_id" ON "reward_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reward_events_delivered" ON "reward_events" USING btree ("delivered");--> statement-breakpoint
CREATE INDEX "idx_reward_events_source_event_id" ON "reward_events" USING btree ("source_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_reward_events_idempotency" ON "reward_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_seasons_blueprint_id" ON "seasons" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_signal_snapshots_blueprint_id" ON "signal_snapshots" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_signal_snapshots_blueprint_current" ON "signal_snapshots" USING btree ("blueprint_id","is_current");--> statement-breakpoint
CREATE INDEX "idx_skill_profiles_user_id" ON "skill_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stability_events_user_id" ON "stability_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stability_events_created_at" ON "stability_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_state_memory_blueprint_id" ON "state_memory" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_state_memory_blueprint_current" ON "state_memory" USING btree ("blueprint_id","is_current");--> statement-breakpoint
CREATE INDEX "idx_strategic_assumptions_blueprint_id" ON "strategic_assumptions" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_strategic_assumptions_status" ON "strategic_assumptions" USING btree ("monitoring_status");--> statement-breakpoint
CREATE INDEX "idx_strategic_outlook_user_generated" ON "strategic_outlook_records" USING btree ("user_id","generated_at");--> statement-breakpoint
CREATE INDEX "idx_strategic_outlook_expires" ON "strategic_outlook_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_system_health_logs_blueprint_id" ON "system_health_logs" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_system_health_logs_check_type" ON "system_health_logs" USING btree ("check_type");--> statement-breakpoint
CREATE INDEX "idx_system_health_logs_area" ON "system_health_logs" USING btree ("area");--> statement-breakpoint
CREATE INDEX "idx_system_health_records_created_at" ON "system_health_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_targets_blueprint_id" ON "targets" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_targets_status" ON "targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_task_generation_log_blueprint_id" ON "task_generation_log" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_task_generation_log_trigger" ON "task_generation_log" USING btree ("generation_trigger");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_task_generation_log_idempotency_key" ON "task_generation_log" USING btree ("idempotency_key") WHERE "task_generation_log"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "idx_task_generation_logs_blueprint_id" ON "task_generation_logs" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_task_generation_logs_user_id" ON "task_generation_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_trend_intelligence_user_created" ON "trend_intelligence" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_trend_intelligence_expires" ON "trend_intelligence" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_achievement" ON "user_achievements" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "idx_user_identity_states_user_id" ON "user_identity_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_identity_states_blueprint_current" ON "user_identity_states" USING btree ("blueprint_id","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_level" ON "user_levels" USING btree ("user_id","level_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_notification_channel" ON "user_notification_channels" USING btree ("user_id","channel_type");--> statement-breakpoint
CREATE INDEX "idx_user_principle_profiles_slug" ON "user_principle_profiles" USING btree ("profile_url_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_reward" ON "user_rewards" USING btree ("user_id","reward_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_social_platform" ON "user_social_accounts" USING btree ("user_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_streak_type" ON "user_streaks" USING btree ("user_id","streak_type");--> statement-breakpoint
CREATE INDEX "idx_validation_archetype_maps_validation_id" ON "validation_archetype_maps" USING btree ("validation_id");--> statement-breakpoint
CREATE INDEX "idx_validation_event_logs_validation_id" ON "validation_event_logs" USING btree ("validation_id");--> statement-breakpoint
CREATE INDEX "idx_validation_event_logs_created_at" ON "validation_event_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_validation_memory_user_id" ON "validation_memory" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_validation_memory_goal_hash" ON "validation_memory" USING btree ("goal_hash");--> statement-breakpoint
CREATE INDEX "idx_validation_memory_blueprint_id" ON "validation_memory" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_validations_blueprint_id" ON "validations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_validations_contract_id" ON "validations" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_validations_idempotency_key" ON "validations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_verdict_evolution_blueprint_id" ON "verdict_evolution" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_weekly_reviews_blueprint_id" ON "weekly_reviews" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_world_models_user_id" ON "world_models" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_xp_ledger_user_earned" ON "xp_ledger" USING btree ("user_id","earned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_academy_analytics_user_date" ON "academy_analytics" USING btree ("user_id","metric_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_content_analytics_user_date" ON "content_analytics" USING btree ("user_id","metric_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_execution_analytics_user_date" ON "execution_analytics" USING btree ("user_id","metric_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_execution_benchmark" ON "execution_benchmarks" USING btree ("user_id","metric_name");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_platform_performance" ON "platform_performance" USING btree ("user_id","platform","metric_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_post_performance" ON "post_performance" USING btree ("user_id","post_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_principle_effectiveness" ON "principle_effectiveness" USING btree ("user_id","principle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_productivity_heatmap" ON "productivity_heatmap" USING btree ("user_id","day_of_week","hour_of_day");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_external_integrations_user_type" ON "external_integrations" USING btree ("user_id","integration_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_zapier_connections_user_zapier" ON "zapier_connections" USING btree ("user_id","zapier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_profile_social_links_user_platform" ON "profile_social_links" USING btree ("user_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_profile_widgets_user_type" ON "profile_widgets" USING btree ("user_id","widget_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_shareable_daily_entries_user_date" ON "shareable_daily_entries" USING btree ("user_id","entry_date");--> statement-breakpoint
CREATE INDEX "idx_shareable_daily_entries_token" ON "shareable_daily_entries" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_belief_conflicts_blueprint_id" ON "bhudhi_belief_conflicts" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_belief_evidence_belief_id" ON "bhudhi_belief_evidence" USING btree ("belief_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_belief_history_belief_id" ON "bhudhi_belief_history" USING btree ("belief_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_belief_records_blueprint_id" ON "bhudhi_belief_records" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_belief_records_state" ON "bhudhi_belief_records" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_belief_records_belief_type" ON "bhudhi_belief_records" USING btree ("belief_type");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_belief_truth_belief_id" ON "bhudhi_belief_truth" USING btree ("belief_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_civilization_events_civilization_id" ON "bhudhi_civilization_events" USING btree ("civilization_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_civilization_forecasts_civilization_id" ON "bhudhi_civilization_forecasts" USING btree ("civilization_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_civilization_memory_blueprint_id" ON "bhudhi_civilization_memory" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_civilization_states_civilization_id" ON "bhudhi_civilization_states" USING btree ("civilization_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_civilizations_blueprint_id" ON "bhudhi_civilizations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_context_states_blueprint_id" ON "bhudhi_context_states" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_decision_forecasts_decision_id" ON "bhudhi_decision_forecasts" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_decision_options_decision_id" ON "bhudhi_decision_options" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_decision_records_blueprint_id" ON "bhudhi_decision_records" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_decision_records_recommendation_id" ON "bhudhi_decision_records" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_decision_records_status" ON "bhudhi_decision_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_decision_replay_decision_id" ON "bhudhi_decision_replay" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_decision_scores_decision_id" ON "bhudhi_decision_scores" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_economics_forecasts_user_id" ON "bhudhi_economics_forecasts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_economics_forecasts_horizon" ON "bhudhi_economics_forecasts" USING btree ("horizon_days");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_economics_logs_user_id" ON "bhudhi_economics_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_economics_logs_session_id" ON "bhudhi_economics_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_economics_profiles_user_id" ON "bhudhi_economics_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_economics_profiles_blueprint_id" ON "bhudhi_economics_profiles" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_economics_sessions_user_id" ON "bhudhi_economics_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_economics_sessions_blueprint_id" ON "bhudhi_economics_sessions" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_economics_sessions_created_at" ON "bhudhi_economics_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_engine_registry_system" ON "bhudhi_engine_registry" USING btree ("system");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_engines_system_id" ON "bhudhi_engines" USING btree ("system_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_engines_status" ON "bhudhi_engines" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_bhudhi_engines_system_name" ON "bhudhi_engines" USING btree ("system_id","name");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_execution_contracts_blueprint_id" ON "bhudhi_execution_contracts" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_execution_contracts_contract_type" ON "bhudhi_execution_contracts" USING btree ("contract_type");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_execution_contracts_status" ON "bhudhi_execution_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_execution_events_blueprint_id" ON "bhudhi_execution_events" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_execution_plans_blueprint_id" ON "bhudhi_execution_plans" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_execution_plans_recommendation_id" ON "bhudhi_execution_plans" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_expansion_benchmarks_capability_id" ON "bhudhi_expansion_benchmarks" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_expansion_capabilities_blueprint_id" ON "bhudhi_expansion_capabilities" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_expansion_capabilities_key" ON "bhudhi_expansion_capabilities" USING btree ("capability_key");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_expansion_events_blueprint_id" ON "bhudhi_expansion_events" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_expansion_history_blueprint_id" ON "bhudhi_expansion_history" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_expansion_memory_blueprint_id" ON "bhudhi_expansion_memory" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_experiment_groups_experiment_id" ON "bhudhi_experiment_groups" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_experiment_memory_experiment_id" ON "bhudhi_experiment_memory" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_experiment_promotions_experiment_id" ON "bhudhi_experiment_promotions" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_experiment_results_experiment_id" ON "bhudhi_experiment_results" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_experiments_blueprint_id" ON "bhudhi_experiments" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_experiments_status" ON "bhudhi_experiments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_external_connections_blueprint_id" ON "bhudhi_external_connections" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_external_data_connection_id" ON "bhudhi_external_data" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_framework_learning_framework_id" ON "bhudhi_framework_learning" USING btree ("framework_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_frameworks_status" ON "bhudhi_frameworks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governance_approvals_blueprint_id" ON "bhudhi_governance_approvals" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governance_approvals_status" ON "bhudhi_governance_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governance_approvals_subject" ON "bhudhi_governance_approvals" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governance_audit_blueprint_id" ON "bhudhi_governance_audit" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governance_audit_event_type" ON "bhudhi_governance_audit" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governance_audit_created_at" ON "bhudhi_governance_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governance_emergency_blueprint_id" ON "bhudhi_governance_emergency" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governance_memory_blueprint_id" ON "bhudhi_governance_memory" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governance_memory_type_key" ON "bhudhi_governance_memory" USING btree ("memory_type","key");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governance_violations_blueprint_id" ON "bhudhi_governance_violations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governor_allocations_blueprint_id" ON "bhudhi_governor_allocations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governor_events_blueprint_id" ON "bhudhi_governor_events" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governor_health_blueprint_id" ON "bhudhi_governor_health" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governor_history_blueprint_id" ON "bhudhi_governor_history" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_governor_recovery_blueprint_id" ON "bhudhi_governor_recovery" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_idea_sets_blueprint_id" ON "bhudhi_idea_sets" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_identity_events_blueprint_id" ON "bhudhi_identity_events" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_identity_growth_profile_id" ON "bhudhi_identity_growth" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_identity_history_profile_id" ON "bhudhi_identity_history" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_identity_profiles_blueprint_id" ON "bhudhi_identity_profiles" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_identity_profiles_user_id" ON "bhudhi_identity_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_identity_values_profile_id" ON "bhudhi_identity_values" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_incident_logs_blueprint_id" ON "bhudhi_incident_logs" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_infra_capacity_blueprint_id" ON "bhudhi_infra_capacity" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_infra_deployments_blueprint_id" ON "bhudhi_infra_deployments" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_infra_events_blueprint_id" ON "bhudhi_infra_events" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_infra_health_blueprint_id" ON "bhudhi_infra_health" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_infra_runtime_blueprint_id" ON "bhudhi_infra_runtime" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_investigations_blueprint_id" ON "bhudhi_investigations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_investigations_engine_id" ON "bhudhi_investigations" USING btree ("engine_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_kernel_events_blueprint_id" ON "bhudhi_kernel_events" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_kernel_events_event_type" ON "bhudhi_kernel_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_kernel_events_chain_id" ON "bhudhi_kernel_events" USING btree ("chain_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_edges_blueprint_id" ON "bhudhi_memory_edges" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_edges_from" ON "bhudhi_memory_edges" USING btree ("from_node_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_edges_to" ON "bhudhi_memory_edges" USING btree ("to_node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_bhudhi_memory_edges" ON "bhudhi_memory_edges" USING btree ("blueprint_id","from_node_id","to_node_id","edge_type");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_nodes_blueprint_id" ON "bhudhi_memory_nodes" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_nodes_node_type" ON "bhudhi_memory_nodes" USING btree ("node_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_bhudhi_memory_nodes_blueprint_type_id" ON "bhudhi_memory_nodes" USING btree ("blueprint_id","node_type","node_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_queries_blueprint_id" ON "bhudhi_memory_queries" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_relationships_blueprint_id" ON "bhudhi_memory_relationships" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_timeline_blueprint_id" ON "bhudhi_memory_timeline" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_memory_timeline_timestamp" ON "bhudhi_memory_timeline" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_modules_system" ON "bhudhi_modules" USING btree ("system");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_organization_events_org_id" ON "bhudhi_organization_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_organization_health_org_id" ON "bhudhi_organization_health" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_organization_memory_org_id" ON "bhudhi_organization_memory" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_organization_roles_org_id" ON "bhudhi_organization_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_organization_roles_user_id" ON "bhudhi_organization_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_organizations_blueprint_id" ON "bhudhi_organizations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_permission_history_blueprint_id" ON "bhudhi_permission_history" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_predictions_blueprint_id" ON "bhudhi_predictions" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bhudhi_protocol_contracts_engines" ON "bhudhi_protocol_contracts" USING btree ("engine_a","engine_b");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_protocol_messages_blueprint_id" ON "bhudhi_protocol_messages" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_protocol_messages_uri" ON "bhudhi_protocol_messages" USING btree ("uri");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_protocol_messages_from_engine" ON "bhudhi_protocol_messages" USING btree ("from_engine");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_protocol_messages_to_engine" ON "bhudhi_protocol_messages" USING btree ("to_engine");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bhudhi_protocol_routes_pattern" ON "bhudhi_protocol_routes" USING btree ("pattern");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_recommendations_blueprint_id" ON "bhudhi_recommendations" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_recommendations_engine_id" ON "bhudhi_recommendations" USING btree ("engine_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_recovery_records_blueprint_id" ON "bhudhi_recovery_records" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_reliability_events_blueprint_id" ON "bhudhi_reliability_events" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_rollback_history_blueprint_id" ON "bhudhi_rollback_history" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_secret_registry_blueprint_id" ON "bhudhi_secret_registry" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_security_events_blueprint_id" ON "bhudhi_security_events" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_shared_context_blueprint_id" ON "bhudhi_shared_context" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_signals_blueprint_id" ON "bhudhi_signals" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_simulation_events_run_id" ON "bhudhi_simulation_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_simulation_memory_blueprint_id" ON "bhudhi_simulation_memory" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_simulation_runs_blueprint_id" ON "bhudhi_simulation_runs" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_simulation_scores_run_id" ON "bhudhi_simulation_scores" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_simulation_worlds_blueprint_id" ON "bhudhi_simulation_worlds" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_strategic_choices_blueprint_id" ON "bhudhi_strategic_choices" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_system_health_blueprint_id" ON "bhudhi_system_health" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_systems_status" ON "bhudhi_systems" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_team_alignment_team_id" ON "bhudhi_team_alignment" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_team_health_team_id" ON "bhudhi_team_health" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_team_identity_team_id" ON "bhudhi_team_identity" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_team_memory_team_id" ON "bhudhi_team_memory" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_teams_blueprint_id" ON "bhudhi_teams" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_temporal_forecasts_blueprint_id" ON "bhudhi_temporal_forecasts" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_temporal_history_blueprint_id" ON "bhudhi_temporal_history" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_temporal_patterns_blueprint_id" ON "bhudhi_temporal_patterns" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_temporal_timelines_blueprint_id" ON "bhudhi_temporal_timelines" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_temporal_windows_blueprint_id" ON "bhudhi_temporal_windows" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_threat_records_blueprint_id" ON "bhudhi_threat_records" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_trust_profiles_blueprint_id" ON "bhudhi_trust_profiles" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bhudhi_unified_execution_contexts_execution_id" ON "bhudhi_unified_execution_contexts" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_unified_execution_contexts_blueprint_id" ON "bhudhi_unified_execution_contexts" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_unified_execution_contexts_execution_type" ON "bhudhi_unified_execution_contexts" USING btree ("execution_type");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_unified_execution_contexts_status" ON "bhudhi_unified_execution_contexts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_unified_execution_feedback_execution_id" ON "bhudhi_unified_execution_feedback" USING btree ("execution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bhudhi_unified_execution_results_execution_id" ON "bhudhi_unified_execution_results" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_unified_execution_results_success" ON "bhudhi_unified_execution_results" USING btree ("success");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bhudhi_unified_execution_steps_exec_step" ON "bhudhi_unified_execution_steps" USING btree ("execution_id","step_number");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_unified_execution_steps_execution_id" ON "bhudhi_unified_execution_steps" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_world_entities_blueprint_id" ON "bhudhi_world_entities" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_world_entities_entity_type" ON "bhudhi_world_entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_world_events_blueprint_id" ON "bhudhi_world_events" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_world_relationships_blueprint_id" ON "bhudhi_world_relationships" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_world_snapshots_blueprint_id" ON "bhudhi_world_snapshots" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_world_states_blueprint_id" ON "bhudhi_world_states" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_bhudhi_world_states_entity_id" ON "bhudhi_world_states" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_blueprint_sequence_history_blueprint_id" ON "blueprint_sequence_history" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_blueprint_sequence_history_sequence_number" ON "blueprint_sequence_history" USING btree ("sequence_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_blueprint_sequences_blueprint_id" ON "blueprint_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_blueprint_tier_sequences_blueprint_id" ON "blueprint_tier_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_context_sequences_blueprint_id" ON "context_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_execution_feedback_sequences_blueprint_id" ON "execution_feedback_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_execution_structure_sequences_blueprint_id" ON "execution_structure_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_goal_sequences_blueprint_id" ON "goal_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_master_plan_sequences_blueprint_id" ON "master_plan_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_mini_plan_allocation_history_blueprint" ON "mini_plan_allocation_history" USING btree ("blueprint_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_mini_plan_sequences_blueprint_id" ON "mini_plan_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_policy_sequences_blueprint_id" ON "policy_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_prediction_scene_sequences_blueprint_id" ON "prediction_scene_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_purpose_sequences_blueprint_id" ON "purpose_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_sequence_flows_blueprint_id" ON "sequence_flows" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_sequence_flows_current" ON "sequence_flows" USING btree ("current_sequence_name");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_signal_condition_sequences_blueprint_id" ON "signal_condition_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_signal_sequences_blueprint_id" ON "signal_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_task_generation_sequences_blueprint_id" ON "task_generation_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_tier_sequence_gates_blueprint_tier" ON "tier_sequence_gates" USING btree ("blueprint_tier");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_tier_sequence_gates_tier_seq_feature" ON "tier_sequence_gates" USING btree ("blueprint_tier","sequence_number","unlocks_feature");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_validation_result_sequences_blueprint_id" ON "validation_result_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_validation_sequences_blueprint_id" ON "validation_sequences" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_adaptation_suggestions_blueprint_id" ON "adaptation_suggestions" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_adaptation_suggestions_sequence_number" ON "adaptation_suggestions" USING btree ("sequence_number");--> statement-breakpoint
CREATE INDEX "idx_growth_execution_patterns_blueprint_id" ON "growth_execution_patterns" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_growth_execution_patterns_pattern_type" ON "growth_execution_patterns" USING btree ("pattern_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_growth_execution_patterns_blueprint_type_name" ON "growth_execution_patterns" USING btree ("blueprint_id","pattern_type","pattern_name");--> statement-breakpoint
CREATE INDEX "idx_interrogation_logs_blueprint_id" ON "interrogation_logs" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_interrogation_logs_sequence_number" ON "interrogation_logs" USING btree ("sequence_number");--> statement-breakpoint
CREATE INDEX "idx_knowledge_cards_blueprint_id" ON "knowledge_cards" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_cards_tier" ON "knowledge_cards" USING btree ("tier");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_knowledge_cards_blueprint_title" ON "knowledge_cards" USING btree ("blueprint_id","title");--> statement-breakpoint
CREATE INDEX "idx_ultimate_emergency_orders_blueprint_id" ON "ultimate_emergency_orders" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_ultimate_emergency_orders_status" ON "ultimate_emergency_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ultimate_emergency_orders_trigger" ON "ultimate_emergency_orders" USING btree ("trigger_event");--> statement-breakpoint
CREATE INDEX "idx_ultimate_predictions_blueprint_id" ON "ultimate_predictions" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_ultimate_scenes_blueprint_id" ON "ultimate_scenes" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_ultimate_validation_checkpoints_blueprint_id" ON "ultimate_validation_checkpoints" USING btree ("blueprint_id");--> statement-breakpoint
CREATE INDEX "idx_ultimate_validation_checkpoints_recovery" ON "ultimate_validation_checkpoints" USING btree ("recovery_needed");