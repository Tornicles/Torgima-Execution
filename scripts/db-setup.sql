-- BHUDHI PROMPT 37 — Production database setup (supplemental indexes)
-- Run after Drizzle migrations 0001–0029 on PostgreSQL (Supabase or self-hosted).
-- Safe to re-run: uses IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Kernel / event bus (Prompt 31)
CREATE INDEX IF NOT EXISTS idx_bhudhi_kernel_events_blueprint_created
  ON bhudhi_kernel_events (blueprint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bhudhi_kernel_events_type_status
  ON bhudhi_kernel_events (event_type, status);

-- Memory graph (Prompt 32)
CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_nodes_blueprint_type
  ON bhudhi_memory_nodes (blueprint_id, node_type);

CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_nodes_confidence
  ON bhudhi_memory_nodes (blueprint_id, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_bhudhi_memory_edges_blueprint_nodes
  ON bhudhi_memory_edges (blueprint_id, from_node_id, to_node_id);

-- Protocol (Prompt 33)
CREATE INDEX IF NOT EXISTS idx_bhudhi_protocol_messages_blueprint_sent
  ON bhudhi_protocol_messages (blueprint_id, sent_at DESC);

-- Unified execution runtime (Prompt 35)
CREATE INDEX IF NOT EXISTS idx_bhudhi_unified_execution_contexts_blueprint_status
  ON bhudhi_unified_execution_contexts (blueprint_id, status);

CREATE INDEX IF NOT EXISTS idx_bhudhi_unified_execution_results_success
  ON bhudhi_unified_execution_results (execution_id, success);

-- Core Torgima operational tables (existing product)
CREATE INDEX IF NOT EXISTS idx_events_pending_created
  ON events (status, created_at DESC)
  WHERE status = 'pending';

ANALYZE bhudhi_kernel_events;
ANALYZE bhudhi_memory_nodes;
ANALYZE bhudhi_protocol_messages;
ANALYZE bhudhi_unified_execution_contexts;
