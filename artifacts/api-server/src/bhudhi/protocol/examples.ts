import type { BhudhiMessage } from "./contracts/types.js";

export const PROTOCOL_EXAMPLES: Record<string, BhudhiMessage> = {
  investigationComplete: {
    version: "1.0",
    messageType: "event",
    from: "investigation",
    to: "intelligence",
    uri: "bhudhi://investigation/complete",
    payload: { blueprintId: "bp-123", investigations: [] },
  },
  intelligenceRecommend: {
    version: "1.0",
    messageType: "response",
    from: "intelligence",
    to: "security",
    uri: "bhudhi://intelligence/recommend",
    payload: { blueprintId: "bp-123", recommendations: [] },
  },
  securityValidate: {
    version: "1.0",
    messageType: "request",
    from: "security",
    to: "operating",
    uri: "bhudhi://security/validate",
    payload: { blueprintId: "bp-123", recommendation: {} },
  },
  operatingExecute: {
    version: "1.0",
    messageType: "event",
    from: "operating",
    to: "preservation",
    uri: "bhudhi://operating/execute",
    payload: { blueprintId: "bp-123", executionPlan: {} },
  },
  preservationLearn: {
    version: "1.0",
    messageType: "event",
    from: "preservation",
    to: "intelligence",
    uri: "bhudhi://preservation/learn",
    payload: { blueprintId: "bp-123", learnings: [] },
  },
};
