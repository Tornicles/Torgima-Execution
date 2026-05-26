export type MomentumMode = "RISING" | "STABLE" | "DECLINING" | "COLLAPSING";
export type WindowClass = "best" | "acceptable" | "avoid";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";

export interface TemporalInput {
  blueprintId: string;
  goal?: string;
  world?: Record<string, unknown>;
  identity?: Record<string, unknown>;
  memory?: string | Record<string, unknown>;
  life?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  constraints?: string[];
  signals?: Record<string, unknown>;
  calendar?: Record<string, unknown>;
  tasks?: Array<{ id: string; title: string; dueAt?: string }>;
  deadlines?: Array<{ label: string; at: string }>;
}

export interface TimeState {
  phase: "past" | "present" | "future";
  now: string;
  horizonDays: number;
}

export interface TemporalOutput {
  sessionId: string;
  timeState: TimeState;
  window: WindowResult;
  recommendation: string;
  urgency: number;
  momentum?: MomentumResult;
  chronology?: ChronologyResult;
  branch?: BranchResult;
  forecast?: ForecastBundle;
}

export interface WindowResult {
  window: WindowClass;
  label: string;
  successProbability: number;
  expiresAt?: string;
  score: number;
}

export interface MomentumResult {
  momentum: number;
  risk: number;
  trajectory: MomentumMode;
  velocity: number;
  consistency: number;
}

export interface ChronologyResult {
  timeline: Array<{ at: string; event: string }>;
  ordering: string[];
  causes: string[];
}

export interface OpportunityResult {
  window: string;
  probability: number;
  score: number;
  recommendedAction: string;
}

export interface TimelineResult {
  timeline: Array<{ phase: string; start: string; end?: string }>;
  health: number;
  buffer: number;
}

export interface BranchResult {
  recommendedPath: string;
  alternatives: Array<{ path: string; cost: number; risk: number; timeDays: number; regret: number }>;
}

export interface ScheduleResult {
  sequence: string[];
  protected: string[];
  rescheduled: string[];
}

export interface ForecastBundle {
  horizons: Array<{ days: number; forecast: Record<string, unknown>; confidence: number }>;
  adjustments: string[];
}
