import { blueprints, db, interrogationLogs } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { interpretFeedback } from "../bhudhi/BhudhiInterpretationEngine.js";
import { AdaptationEngine } from "./AdaptationEngine.js";
import type {
  InterrogationCategory,
  InterrogationContext,
  InterrogationInsight,
} from "../../types/growth.js";
import { GROWTH_SEQUENCE_NUMBER } from "./growthGate.js";

const INTERROGATION_LIBRARY: Record<InterrogationCategory, string[]> = {
  blocker: [
    "When you hit this blocker, what's your first instinct—solve it yourself or ask for help?",
    "Have you seen this type of obstacle before? How did you handle it then?",
    "What's the biggest uncertainty about how to move past this?",
  ],
  execution_style: [
    "Do you prefer to work in one big session or break it into smaller parts?",
    "What time of day do you do your best work?",
    "Are you more motivated by progress or completion?",
  ],
  environment: [
    "What's your ideal working environment? Any distractions to watch out for?",
    "Do you work better with structure or flexibility?",
  ],
  capability: [
    "Is there a skill you'd like to develop to make this easier?",
    "What would unlock your ability to move faster?",
  ],
};

async function currentSequenceNumber(blueprintId: string): Promise<number> {
  const [row] = await db
    .select({ current_sequence_number: blueprints.current_sequence_number })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return row?.current_sequence_number ?? GROWTH_SEQUENCE_NUMBER;
}

export function extractInterrogationInsight(question: string, answer: string): InterrogationInsight {
  const lower = answer.toLowerCase();
  const actionable =
    lower.includes("help") ||
    lower.includes("reduce") ||
    lower.includes("break") ||
    lower.includes("schedule") ||
    answer.trim().length > 40;

  let suggested_adjustment: string | undefined;
  if (/myself|solo|alone/i.test(answer)) {
    suggested_adjustment = "Add a short checkpoint before escalating blockers";
  } else if (/help|ask|support/i.test(answer)) {
    suggested_adjustment = "Surface help resources earlier when friction appears";
  } else if (/morning|evening|night/i.test(answer)) {
    suggested_adjustment = "Schedule high-focus tasks in your peak window";
  } else if (/smaller|break|chunk/i.test(answer)) {
    suggested_adjustment = "Split orders into smaller proof-sized steps";
  }

  const insight = actionable
    ? `User preference captured for: ${question.slice(0, 80)}…`
    : `Context noted from response (${answer.slice(0, 60)}…)`;

  return {
    insight,
    actionable,
    suggested_adjustment,
    reasoning: "Deterministic interrogation insight (Growth tier)",
    confidence: actionable ? 0.72 : 0.45,
  };
}

export const InterrogationService = {
  shouldAskQuestion(_blueprintId: string, context: InterrogationContext): boolean {
    if (context.feedback_sentiment === "negative") return true;
    if (context.current_sequence % 5 === 0) return true;
    if (context.pattern_suspected) return true;
    return false;
  },

  generateQuestion(
    _blueprintId: string,
    context: InterrogationContext,
  ): { question: string; category: InterrogationCategory; context: string } {
    let category: InterrogationCategory = "execution_style";
    let contextStr = "General execution understanding";

    if (context.pattern_suspected === "blocker" || context.pattern_suspected.includes("blocker")) {
      category = "blocker";
      contextStr = "Understanding blocker resolution patterns";
    } else if (context.feedback_sentiment === "negative") {
      category = "capability";
      contextStr = "Identifying capability gaps from struggles";
    }

    const questions = INTERROGATION_LIBRARY[category];
    const question = questions[Math.floor(Math.random() * questions.length)] ?? questions[0]!;

    return { question, category, context: contextStr };
  },

  async recordQuestion(blueprintId: string, question: string, category: string, context: string) {
    const [row] = await db
      .insert(interrogationLogs)
      .values({
        blueprint_id: blueprintId,
        sequence_number: await currentSequenceNumber(blueprintId),
        question,
        category,
        context,
      })
      .returning();
    return row!;
  },

  async recordAnswer(interrogationId: string, answer: string) {
    const [log] = await db
      .select()
      .from(interrogationLogs)
      .where(eq(interrogationLogs.id, interrogationId))
      .limit(1);

    if (!log) {
      throw new Error("Interrogation log not found");
    }

    const deterministic = extractInterrogationInsight(log.question, answer);
    let insight = deterministic;

    try {
      const bhudhi = await interpretFeedback(
        {
          completed: "completed",
          reflection: `${log.question}\n\nUser answer: ${answer}`,
          score: 7,
        },
        { blueprintId: log.blueprint_id },
      );
      if (bhudhi.key_insight) {
        insight = {
          ...deterministic,
          insight: bhudhi.key_insight,
          actionable: deterministic.actionable || bhudhi.triggers_regeneration,
          suggested_adjustment:
            deterministic.suggested_adjustment ?? bhudhi.learning_extracted,
          confidence: Math.max(deterministic.confidence, bhudhi.feedback_confidence),
        };
      }
    } catch {
      // Bhudhi optional — deterministic insight is sufficient
    }

    const [updated] = await db
      .update(interrogationLogs)
      .set({
        user_answer: answer,
        insight_extracted: insight.insight,
        insight_actionable: insight.actionable,
      })
      .where(eq(interrogationLogs.id, interrogationId))
      .returning();

    if (insight.actionable && insight.suggested_adjustment) {
      await AdaptationEngine.recordSuggestion(
        log.blueprint_id,
        log.category,
        answer,
        insight.suggested_adjustment,
        insight.reasoning,
        insight.confidence,
        insight.insight,
      );
    }

    return updated!;
  },

  async getHistory(blueprintId: string) {
    return db
      .select()
      .from(interrogationLogs)
      .where(eq(interrogationLogs.blueprint_id, blueprintId))
      .orderBy(desc(interrogationLogs.created_at));
  },
};
