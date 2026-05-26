export type ProtocolMessageType = "request" | "response" | "event" | "query";

export type ProtocolMessageStatus = "sent" | "delivered" | "processed" | "failed";

export interface BhudhiMessage {
  version: string;
  messageType: ProtocolMessageType;
  from: string;
  to: string;
  uri: string;
  payload: Record<string, unknown>;
  sequenceNumber?: number;
}

export interface ParsedBhudhiUri {
  system: string;
  action: string;
  params: Record<string, string>;
}

export interface StoredProtocolMessage {
  id: string;
  blueprintId: string;
  version: string;
  messageType: ProtocolMessageType;
  from: string;
  to: string;
  uri: string;
  payload: Record<string, unknown>;
  routeId: string;
  sequenceNumber: number;
  status: ProtocolMessageStatus;
  sentAt: Date;
  processedAt: Date | null;
  latencyMs: number | null;
  createdAt: Date;
}

export interface ProtocolRouteRecord {
  id: string;
  pattern: string;
  handler: string;
  requestSchema: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  async: boolean;
  timeoutMs: number;
  retries: number;
  description: string;
}

export type ProtocolHandler = (
  payload: Record<string, unknown>,
  message: StoredProtocolMessage,
) => Promise<unknown>;
