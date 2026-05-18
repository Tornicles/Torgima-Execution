import { db, knowledgePackages, bhudhiMemory } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { writeMemory } from "../MemoryService.js";
import { logger } from "../../lib/logger.js";

export interface KnowledgeSelectionInput {
  domain: string;
  actionType: string;
  userId: string;
  phaseType?: string;
}

export type KnowledgePackageRow = typeof knowledgePackages.$inferSelect;

const SEED_PACKAGES: Array<Omit<typeof knowledgePackages.$inferInsert, "id">> = [
  {
    domain: "Content",
    action_type: "Create",
    sop: "Hook (3 seconds) → Value delivery → CTA. Script before recording. Edit for retention not length.",
    benchmark: "Retention > 40% at 30 seconds. CTR > 3%. Save rate > 5%.",
    tool_recommendations: ["CapCut", "Descript", "Canva"],
    common_mistakes: ["Starting without a hook", "Too long intro", "No clear CTA"],
    good_output_example: "Video with strong hook, clear value in first 15 seconds, CTA in last 5 seconds.",
    execution_guidance:
      "1. Write hook first. 2. Film in one location. 3. Edit on mobile. 4. Add captions. 5. Post within 2h.",
  },
  {
    domain: "Content",
    action_type: "Analyze",
    sop: "Compare retention, engagement, save rate, share rate. Identify drop-off point.",
    benchmark: "Average retention > 50% = strong. < 30% = hook or content problem.",
    tool_recommendations: ["Platform analytics", "Notion tracking"],
    common_mistakes: ["Only looking at views", "Ignoring save rate"],
    good_output_example: "Report: top 3 posts, shared patterns, 2 changes to make.",
    execution_guidance: "Export metrics → chart drop-off → write 3 actionable changes.",
  },
  {
    domain: "Growth",
    action_type: "Create",
    sop: "Define ICP → offer → channel → single CTA experiment.",
    benchmark: "Reply rate > 5% on outbound; landing conversion > 2%.",
    tool_recommendations: ["CRM", "Landing page builder"],
    common_mistakes: ["Broad targeting", "Multiple CTAs"],
    good_output_example: "One channel experiment with measurable reply or signup metric.",
    execution_guidance: "Pick one channel, one message, one metric for 7 days.",
  },
  {
    domain: "Operations",
    action_type: "Improve",
    sop: "Map current workflow → identify bottleneck → ship smallest fix.",
    benchmark: "Cycle time reduced or error rate down week-over-week.",
    tool_recommendations: ["Notion", "Loom", "Checklists"],
    common_mistakes: ["Optimizing non-bottleneck steps"],
    good_output_example: "Documented before/after with one metric improved.",
    execution_guidance: "Time-box discovery, implement one fix, measure next cycle.",
  },
  {
    domain: "Market",
    action_type: "Analyze",
    sop: "Competitor scan → positioning gap → proof-backed claim.",
    benchmark: "3 competitors mapped with differentiated angle.",
    tool_recommendations: ["Spreadsheet", "Customer interviews"],
    common_mistakes: ["Feature lists without buyer outcome"],
    good_output_example: "Positioning memo with 3 competitor weaknesses and your wedge.",
    execution_guidance: "Interview 2 users, compare 3 competitors, write wedge statement.",
  },
  {
    domain: "Learning",
    action_type: "Replicate",
    sop: "Deconstruct exemplar → extract steps → reproduce minimum viable version.",
    benchmark: "Replica achieves 70% of exemplar quality in one iteration.",
    tool_recommendations: ["Screen recorder", "Template library"],
    common_mistakes: ["Copying surface style without underlying structure"],
    good_output_example: "Replica artifact with gap list vs exemplar.",
    execution_guidance: "List steps from exemplar, execute smallest replica, compare gaps.",
  },
];

let seedPromise: Promise<void> | null = null;

export async function buildInitialKnowledgeLibrary(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      for (const pkg of SEED_PACKAGES) {
        const existing = await db
          .select({ id: knowledgePackages.id })
          .from(knowledgePackages)
          .where(
            and(
              eq(knowledgePackages.domain, pkg.domain),
              eq(knowledgePackages.action_type, pkg.action_type),
            ),
          )
          .limit(1);
        if (existing.length > 0) continue;
        await db.insert(knowledgePackages).values(pkg);
      }
      logger.info("[KnowledgeAgent] Seed library ensured");
    })();
  }
  await seedPromise;
}

function mapDomainToLibrary(domain: string): string {
  const d = domain.toLowerCase();
  if (d.includes("content") || d === "delivery") return "Content";
  if (d.includes("growth") || d === "genesis") return "Growth";
  if (d.includes("operation")) return "Operations";
  if (d.includes("market")) return "Market";
  if (d.includes("learn") || d === "academy") return "Learning";
  return "Growth";
}

function mapActionType(raw: string): string {
  const a = raw.toLowerCase();
  if (a.includes("analy")) return "Analyze";
  if (a.includes("replic") || a.includes("copy")) return "Replicate";
  if (a.includes("improv")) return "Improve";
  return "Create";
}

export async function selectPackage(
  input: KnowledgeSelectionInput,
): Promise<KnowledgePackageRow | null> {
  await buildInitialKnowledgeLibrary();

  const domain = mapDomainToLibrary(input.domain);
  const actionType = mapActionType(input.actionType);

  const accessed = await db
    .select({ content_json: bhudhiMemory.content_json })
    .from(bhudhiMemory)
    .where(
      and(
        eq(bhudhiMemory.user_id, input.userId),
        eq(bhudhiMemory.memory_type, "KNOWLEDGE_ACCESSED"),
      ),
    )
    .orderBy(desc(bhudhiMemory.created_at))
    .limit(20);

  const usedIds = new Set<string>();
  for (const row of accessed) {
    const payload = row.content_json as { text?: string };
    try {
      const parsed = JSON.parse(payload.text ?? "{}") as { packageId?: string };
      if (parsed.packageId) usedIds.add(parsed.packageId);
    } catch {
      /* skip malformed memory */
    }
  }

  const candidates = await db
    .select()
    .from(knowledgePackages)
    .where(
      and(eq(knowledgePackages.domain, domain), eq(knowledgePackages.action_type, actionType)),
    )
    .orderBy(desc(knowledgePackages.updated_at));

  const pick = candidates.find(c => !usedIds.has(c.id)) ?? candidates[0] ?? null;

  if (pick) {
    await writeMemory({
      userId: input.userId,
      memoryType: "KNOWLEDGE_ACCESSED",
      scope: "USER",
      content: JSON.stringify({ packageId: pick.id, domain, actionType }),
      sourceType: "knowledge_agent",
      confidence: "MEDIUM",
    }).catch(() => null);
  }

  return pick ?? null;
}

export async function enrichPackagesWithEIS(
  userId: string,
  domain: string,
  eisBriefing: Record<string, unknown>,
): Promise<number> {
  const libDomain = mapDomainToLibrary(domain);
  const topics = (eisBriefing["trendingTopics"] as string[] | undefined) ?? [];
  if (topics.length === 0) return 0;

  const [row] = await db
    .select()
    .from(knowledgePackages)
    .where(
      and(eq(knowledgePackages.domain, libDomain), eq(knowledgePackages.action_type, "Create")),
    )
    .limit(1);

  if (!row) return 0;

  const trendNote = `Trending: ${topics.slice(0, 3).join(", ")}`;
  await db
    .update(knowledgePackages)
    .set({
      sop: `${row.sop ?? ""}\n${trendNote}`.trim(),
      good_output_example: row.good_output_example ?? trendNote,
      eis_enriched: true,
      updated_at: new Date(),
    })
    .where(eq(knowledgePackages.id, row.id));

  await writeMemory({
    userId,
    memoryType: "KNOWLEDGE_ACCESSED",
    scope: "USER",
    content: JSON.stringify({ packageId: row.id, eisEnriched: true }),
    sourceType: "knowledge_agent",
    confidence: "LOW",
  }).catch(() => null);

  return 1;
}

export interface AcademyKnowledgeInput {
  skillCategory: string;
  domain: string;
  practiceType: "EXPLANATION" | "DEMONSTRATION" | "PRACTICE" | "ASSESSMENT";
  currentSkillLevel: number;
  lessonNumber: number;
  userId: string;
}

export interface AcademyKnowledgePackage {
  skillCategory: string;
  conceptExplanation: string;
  howToLearn: string;
  commonMistakes: string[];
  masteryIndicators: string[];
  practiceGuide: string;
  exampleOfMastery: string;
  selfAssessmentQuestions: string[];
}

export async function selectAcademyKnowledge(
  input: AcademyKnowledgeInput,
): Promise<AcademyKnowledgePackage> {
  await buildInitialKnowledgeLibrary();
  const libDomain = mapDomainToLibrary(input.domain);
  const actionType =
    input.practiceType === "ASSESSMENT"
      ? "Analyze"
      : input.practiceType === "DEMONSTRATION"
        ? "Replicate"
        : "Create";

  const [pkg] = await db
    .select()
    .from(knowledgePackages)
    .where(
      and(eq(knowledgePackages.domain, libDomain), eq(knowledgePackages.action_type, actionType)),
    )
    .limit(1);

  const skillLabel = input.skillCategory.replace(/_/g, " ");
  const sop = pkg?.sop ?? `Execute ${skillLabel} with deliberate practice.`;
  const mistakes = pkg?.common_mistakes ?? ["Rushing without structure", "Skipping proof of work"];

  return {
    skillCategory: input.skillCategory,
    conceptExplanation: `Strong ${skillLabel} capability directly affects execution velocity and signal quality.`,
    howToLearn: `Apply → review evidence → adjust. Focus on one sub-skill per execution step.`,
    commonMistakes: mistakes,
    masteryIndicators: [
      `Repeatable ${skillLabel} output without external prompting`,
      "Measurable improvement vs prior attempt",
    ],
    practiceGuide: sop,
    exampleOfMastery: pkg?.good_output_example ?? `Exemplar ${skillLabel} execution with clear evidence.`,
    selfAssessmentQuestions: [
      `Did I apply ${skillLabel} deliberately, not by accident?`,
      "Can I reproduce this outcome tomorrow?",
      "What specific evidence proves capability, not activity?",
    ],
  };
}

export function packageToInjection(pkg: KnowledgePackageRow): Record<string, unknown> {
  return {
    packageId: pkg.id,
    sop: pkg.sop,
    benchmark: pkg.benchmark,
    toolRecommendations: pkg.tool_recommendations,
    commonMistakes: pkg.common_mistakes,
    goodExample: pkg.good_output_example,
    guidance: pkg.execution_guidance,
  };
}
