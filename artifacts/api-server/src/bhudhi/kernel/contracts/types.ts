export type KernelEventStatus = "emitted" | "processing" | "completed" | "failed";

export interface KernelEventInput {
  id?: string;
  blueprintId: string;
  eventType: string;
  sourceEngine: string;
  targetEngine?: string;
  payload: Record<string, unknown>;
  chainId?: string;
  parentEventId?: string;
}

export interface StoredKernelEvent {
  id: string;
  blueprintId: string;
  eventType: string;
  sourceEngine: string;
  targetEngine: string;
  payload: Record<string, unknown>;
  status: KernelEventStatus;
  processedBy: string[];
  parentEventId: string | null;
  chainId: string;
  createdAt: Date;
}

export type EventHandler = (event: StoredKernelEvent) => Promise<void>;

export interface SharedContextRecord {
  blueprintId: string;
  domain: string;
  phase: string;
  signal: string;
  condition: string;
  context: Record<string, unknown>;
  ideas: Record<string, unknown>;
  strategy: Record<string, unknown>;
  predictions: Record<string, unknown>;
  knowledge: Record<string, unknown>;
  behavior: Record<string, unknown>;
  execution: Record<string, unknown>;
  investigations: Record<string, unknown>;
  version: number;
  lastUpdateEngine: string;
}

export interface CycleResult {
  chainId: string;
  context: SharedContextRecord;
  eventIds: string[];
  contracts: string[];
  status: "completed" | "partial" | "failed";
  message: string;
}
