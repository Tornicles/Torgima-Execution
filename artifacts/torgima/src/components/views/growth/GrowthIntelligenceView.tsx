import { useCallback, useEffect, useState } from "react";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { cards, buttons, PageEmpty, PageLoading } from "@/design";
import { apiGet, apiPost } from "@/lib/torgima-api";

type Tab = "knowledge" | "interrogation" | "adaptation" | "patterns";

type KnowledgeCard = {
  id: string;
  title: string;
  category: string;
  content: string;
  viewed_count: number;
  helpful_count: number;
};

type InterrogationLog = {
  id: string;
  question: string;
  user_answer?: string | null;
  insight_extracted?: string | null;
  category: string;
  created_at: string;
};

type AdaptationSuggestion = {
  id: string;
  pattern_detected: string;
  suggested_change: string;
  reasoning: string;
  confidence: number;
  user_applied: boolean;
};

type ExecutionPattern = {
  id: string;
  pattern_name: string;
  pattern_type: string;
  confidence: number;
  impact?: string | null;
  suggested_fix?: string | null;
  occurrence_count: number;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "knowledge", label: "Knowledge" },
  { id: "interrogation", label: "Interrogation" },
  { id: "adaptation", label: "Adaptation" },
  { id: "patterns", label: "Patterns" },
];

export function GrowthIntelligenceView({ initialTab = "knowledge" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [knowledgeCards, setKnowledgeCards] = useState<KnowledgeCard[]>([]);
  const [history, setHistory] = useState<InterrogationLog[]>([]);
  const [pendingAdaptations, setPendingAdaptations] = useState<AdaptationSuggestion[]>([]);
  const [patterns, setPatterns] = useState<ExecutionPattern[]>([]);

  const [activeQuestion, setActiveQuestion] = useState<{ id: string; question: string } | null>(
    null,
  );
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLocked(false);
    try {
      if (tab === "knowledge") {
        const data = await apiGet<{ cards: KnowledgeCard[] }>("/api/v1/growth/knowledge");
        setKnowledgeCards(data.cards ?? []);
      } else if (tab === "interrogation") {
        const data = await apiGet<{ history: InterrogationLog[] }>("/api/v1/growth/interrogation");
        setHistory(data.history ?? []);
      } else if (tab === "adaptation") {
        const data = await apiGet<{ pending: AdaptationSuggestion[] }>("/api/v1/growth/adaptation");
        setPendingAdaptations(data.pending ?? []);
      } else {
        const data = await apiGet<{ patterns: ExecutionPattern[] }>("/api/v1/growth/patterns");
        setPatterns(data.patterns ?? []);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Growth features unavailable";
      if (msg.toLowerCase().includes("403") || msg.toLowerCase().includes("disabled")) {
        setLocked(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateQuestion() {
    setSubmitting(true);
    try {
      const data = await apiPost<{ interrogation_id: string; question: string }>(
        "/api/v1/growth/interrogation",
        { action: "generate" },
      );
      setActiveQuestion({ id: data.interrogation_id, question: data.question });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate question");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAnswer() {
    if (!activeQuestion || answer.trim().length < 5) return;
    setSubmitting(true);
    try {
      await apiPost("/api/v1/growth/interrogation", {
        action: "answer",
        interrogationId: activeQuestion.id,
        answer: answer.trim(),
      });
      setActiveQuestion(null);
      setAnswer("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save answer");
    } finally {
      setSubmitting(false);
    }
  }

  async function applyAdaptation(id: string) {
    await apiPost("/api/v1/growth/adaptation/apply", { suggestionId: id, effectiveness: 0.75 });
    await load();
  }

  async function markHelpful(cardId: string) {
    await apiPost(`/api/v1/growth/knowledge/${cardId}/helpful`, {});
    await load();
  }

  if (loading) return <PageLoading />;

  if (locked) {
    return (
      <DashboardPageLayout
        title="Growth Intelligence"
        subtitle="Unlocks at Sequence 24 on Growth or Ultimate tier."
      >
        <PageEmpty
          title="Growth features locked"
          description="Complete Starter sequences (through 23) and use a Growth or Ultimate blueprint to access interrogation, knowledge cards, adaptations, and pattern learning."
        />
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      title="Growth Intelligence"
      subtitle="Sequence 24 — interrogation, knowledge, adaptation, and patterns."
      headerRight={
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? buttons.primary
                  : "px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {error ? (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      ) : null}

      {tab === "knowledge" && (
        <div className="space-y-4">
          {knowledgeCards.length === 0 ? (
            <PageEmpty title="No knowledge cards yet" description="Cards seed on Growth blueprint launch." />
          ) : (
            knowledgeCards.map((card) => (
              <article key={card.id} className={cards.padded}>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{card.title}</h2>
                    <p className="text-xs text-gray-500 capitalize">{card.category.replace(/_/g, " ")}</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-emerald-700 hover:underline"
                    onClick={() => void markHelpful(card.id)}
                  >
                    Helpful ({card.helpful_count})
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-gray-700 font-sans">{card.content}</pre>
              </article>
            ))
          )}
        </div>
      )}

      {tab === "interrogation" && (
        <div className="space-y-4">
          <div className={cards.padded}>
            <p className="text-sm text-gray-600 mb-3">
              Clarifying questions based on your execution patterns.
            </p>
            {!activeQuestion ? (
              <button
                type="button"
                className={buttons.primary}
                disabled={submitting}
                onClick={() => void generateQuestion()}
              >
                Ask me a question
              </button>
            ) : (
              <div className="space-y-3">
                <p className="font-medium">{activeQuestion.question}</p>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm min-h-[100px]"
                  placeholder="Your answer…"
                />
                <button
                  type="button"
                  className={buttons.primary}
                  disabled={submitting}
                  onClick={() => void submitAnswer()}
                >
                  Submit answer
                </button>
              </div>
            )}
          </div>
          {history.map((log) => (
            <div key={log.id} className={cards.padded}>
              <p className="text-xs text-gray-500">{log.category}</p>
              <p className="font-medium mt-1">{log.question}</p>
              {log.user_answer ? (
                <p className="text-sm text-gray-600 mt-2">You: {log.user_answer}</p>
              ) : null}
              {log.insight_extracted ? (
                <p className="text-sm text-emerald-800 mt-2">Insight: {log.insight_extracted}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {tab === "adaptation" && (
        <div className="space-y-4">
          {pendingAdaptations.length === 0 ? (
            <PageEmpty title="No pending adaptations" description="Submit feedback to generate suggestions." />
          ) : (
            pendingAdaptations.map((s) => (
              <div key={s.id} className={cards.padded}>
                <p className="text-xs text-gray-500">{s.pattern_detected}</p>
                <p className="font-medium mt-1">{s.suggested_change}</p>
                <p className="text-sm text-gray-600 mt-2">{s.reasoning}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Confidence {(s.confidence * 100).toFixed(0)}%
                </p>
                <button
                  type="button"
                  className={`${buttons.primary} mt-3`}
                  onClick={() => void applyAdaptation(s.id)}
                >
                  I applied this
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "patterns" && (
        <div className="space-y-4">
          {patterns.length === 0 ? (
            <PageEmpty title="No patterns yet" description="Need at least 3 feedback entries to detect patterns." />
          ) : (
            patterns.map((p) => (
              <div key={p.id} className={cards.padded}>
                <div className="flex justify-between">
                  <h3 className="font-semibold">{p.pattern_name}</h3>
                  <span className="text-xs text-gray-500">{p.pattern_type}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Observed {p.occurrence_count}× · {(p.confidence * 100).toFixed(0)}% confidence
                  {p.impact ? ` · ${p.impact}` : ""}
                </p>
                {p.suggested_fix ? (
                  <p className="text-sm text-emerald-800 mt-2">{p.suggested_fix}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </DashboardPageLayout>
  );
}
