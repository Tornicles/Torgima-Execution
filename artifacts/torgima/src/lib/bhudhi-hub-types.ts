export type BhudhiQuestionCategory = "tasks" | "execution" | "strategy" | "self";

export interface BhudhiHubPanels {
  core: {
    active: boolean;
    online: boolean;
    allSystemsConnected: boolean;
    lastSyncAt: string | null;
    lastSyncLabel: string;
  };
  pipeline: Array<{ id: string; name: string; live: boolean; status: string }>;
  glance: {
    condition: string;
    conditionLabel: string;
    momentum: string;
    momentumRaw: number;
    focus: string;
    goalProgressPercent: number;
  };
  systemActivity: Array<{
    id: string;
    title: string;
    reason: string;
    at: string;
    source: string;
  }>;
  popularQuestions: Record<
    BhudhiQuestionCategory,
    { title: string; questionCount: number; questions: Array<{ key: string; label: string }> }
  >;
  recentQuestions: Array<{
    id: string;
    question: string;
    context: string | null;
    at: string;
  }>;
  totalQuestions: number;
  primaryOrderTitle: string | null;
}

export interface BhudhiExplainResponse {
  questionKey: string;
  label: string;
  explanation: {
    title: string;
    sections: Array<{ heading: string; body: string }>;
    confidence: number;
  };
  aiEnrichment: Record<string, unknown> | null;
  fallbackUsed: boolean;
  principle: string;
}
