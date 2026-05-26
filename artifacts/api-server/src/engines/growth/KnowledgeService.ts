import { blueprints, db, knowledgeCards } from "@workspace/db";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";

export const SEED_KNOWLEDGE_CARDS = [
  {
    tier: "Growth",
    category: "blocker_resolution",
    title: "Handling Technical Blockers",
    content: `# Technical Blockers

When you hit a technical problem:
1. **Document it** - Write down exactly what's happening
2. **Isolate it** - Can you reproduce it consistently?
3. **Escalate** - Check if you have resources to resolve it

If you can't solve in 30 minutes, it's a blocker. Mark it and move on.`,
    keyword_triggers: ["blocker", "stuck", "error", "fail", "can't"],
    relevant_at_seq: 14,
  },
  {
    tier: "Growth",
    category: "execution",
    title: "Finding Your Execution Rhythm",
    content: `# Execution Rhythm

Different people work best at different paces:
- **Sprinters** - Work in focused 2-3 hour sessions, then rest
- **Marathoners** - Work steadily over 8h/day, consistent pace
- **Cyclers** - Alternate intense and light days

Identify your type and plan accordingly.`,
    keyword_triggers: ["tired", "pace", "rhythm", "energy"],
    relevant_at_seq: 15,
  },
  {
    tier: "Growth",
    category: "efficiency",
    title: "Task Prioritization in Execution",
    content: `# Smart Task Selection

When you have multiple tasks:
1. **Quick wins first** (< 30 min) - Build momentum
2. **Dependencies next** - Unblock others
3. **Complex** - When energy is highest`,
    keyword_triggers: ["priority", "order", "sequence", "decide", "choose"],
    relevant_at_seq: 16,
  },
  {
    tier: "Ultimate",
    category: "learning",
    title: "Continuous Improvement Patterns",
    content: `# Learning from Execution

Every execution cycle teaches you:
- What you estimated vs actual time
- What blockers are recurring
- What execution pace works for you

Review these weekly to improve your predictions.`,
    keyword_triggers: ["learn", "improve", "pattern", "repeat", "similar"],
    relevant_at_seq: 24,
  },
] as const;

function tierLabel(tier: string): string {
  const t = tier.toLowerCase();
  if (t === "ultimate") return "Ultimate";
  if (t === "growth") return "Growth";
  return "Starter";
}

export const KnowledgeService = {
  async seedKnowledgeCards(blueprintId: string, tier: string) {
    const label = tierLabel(tier);
    const filtered = SEED_KNOWLEDGE_CARDS.filter(
      (card) => card.tier === label || (label === "Ultimate" && card.tier === "Growth"),
    );

    for (const card of filtered) {
      await db
        .insert(knowledgeCards)
        .values({
          blueprint_id: blueprintId,
          tier: card.tier,
          category: card.category,
          title: card.title,
          content: card.content,
          relevant_at_seq: card.relevant_at_seq,
          keyword_triggers: [...card.keyword_triggers],
        })
        .onConflictDoNothing();
    }
  },

  async getAllCards(blueprintId: string) {
    return db
      .select()
      .from(knowledgeCards)
      .where(eq(knowledgeCards.blueprint_id, blueprintId))
      .orderBy(knowledgeCards.relevant_at_seq);
  },

  async getRelevantCards(
    blueprintId: string,
    currentSequence: number,
    feedbackKeywords: string[],
  ) {
    const sequenceCards = await db
      .select()
      .from(knowledgeCards)
      .where(
        and(
          eq(knowledgeCards.blueprint_id, blueprintId),
          or(
            isNull(knowledgeCards.relevant_at_seq),
            lte(knowledgeCards.relevant_at_seq, currentSequence),
          ),
        ),
      );

    const keywords = feedbackKeywords.map((k) => k.toLowerCase());
    const relevant = sequenceCards.filter((card) => {
      if (!keywords.length) return true;
      return card.keyword_triggers.some((trigger) =>
        keywords.some(
          (keyword) =>
            keyword.includes(trigger.toLowerCase()) || trigger.toLowerCase().includes(keyword),
        ),
      );
    });

    return relevant.slice(0, 5);
  },

  async markViewed(cardId: string) {
    await db
      .update(knowledgeCards)
      .set({ viewed_count: sql`${knowledgeCards.viewed_count} + 1` })
      .where(eq(knowledgeCards.id, cardId));
  },

  async markHelpful(cardId: string) {
    await db
      .update(knowledgeCards)
      .set({ helpful_count: sql`${knowledgeCards.helpful_count} + 1` })
      .where(eq(knowledgeCards.id, cardId));
  },
};
