import { db, contradictionRecords } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export type ContradictionSeverity = "HARD" | "SOFT";

export interface ContradictionInput {
  userId: string;
  blueprintId: string;
  goal: string;
  purpose?: string;
  timeframe?: string;
}

export interface ContradictionResult {
  detected: boolean;
  severity?: ContradictionSeverity;
  contradictionType?: string;
  description?: string;
  elements?: Array<{ element: string; conflictsWith: string }>;
  recordId?: string;
}

const HARD_PATTERNS: Array<{ test: (g: string) => boolean; type: string; description: string; elements: ContradictionResult["elements"] }> = [
  {
    test: g =>
      /\b(privacy|private|anonymous|hidden)\b/i.test(g) &&
      /\b(global|worldwide|influence|fame|viral)\b/i.test(g) &&
      /\b(no team|solo|alone|without help)\b/i.test(g),
    type: "GOAL_HARD",
    description: "Goal pairs total privacy with global influence and no team support.",
    elements: [
      { element: "total privacy", conflictsWith: "global influence" },
      { element: "solo execution", conflictsWith: "scale without team" },
    ],
  },
];

const SOFT_PATTERNS: Array<{ test: (g: string, t?: string) => boolean; type: string; description: string }> = [
  {
    test: (g, t) => {
      const ambitious = /\b(1m|million|100k|dominate|#1|unicorn)\b/i.test(g);
      const short = t ? /\b(\d+\s*day|week|month)\b/i.test(t) : /\b(30 days|one month|2 weeks)\b/i.test(g);
      return ambitious && short;
    },
    type: "GOAL_SOFT",
    description: "Ambitious outcome with a compressed timeline may need adjustment.",
  },
];

export async function detectContradictions(input: ContradictionInput): Promise<ContradictionResult> {
  const goal = `${input.goal} ${input.purpose ?? ""} ${input.timeframe ?? ""}`.trim();

  for (const pattern of HARD_PATTERNS) {
    if (pattern.test(goal)) {
      const [row] = await db
        .insert(contradictionRecords)
        .values({
          user_id: input.userId,
          blueprint_id: input.blueprintId,
          contradiction_type: pattern.type,
          description: pattern.description,
          elements: pattern.elements ?? [],
          severity: "HARD",
          status: "PENDING",
        })
        .returning({ id: contradictionRecords.id });
      return {
        detected: true,
        severity: "HARD",
        contradictionType: pattern.type,
        description: pattern.description,
        elements: pattern.elements,
        recordId: row?.id,
      };
    }
  }

  for (const pattern of SOFT_PATTERNS) {
    if (pattern.test(goal, input.timeframe)) {
      const [row] = await db
        .insert(contradictionRecords)
        .values({
          user_id: input.userId,
          blueprint_id: input.blueprintId,
          contradiction_type: pattern.type,
          description: pattern.description,
          elements: [],
          severity: "SOFT",
          status: "PENDING",
        })
        .returning({ id: contradictionRecords.id });
      return {
        detected: true,
        severity: "SOFT",
        contradictionType: pattern.type,
        description: pattern.description,
        recordId: row?.id,
      };
    }
  }

  return { detected: false };
}

export async function hasHardContradiction(blueprintId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: contradictionRecords.id })
    .from(contradictionRecords)
    .where(
      and(
        eq(contradictionRecords.blueprint_id, blueprintId),
        eq(contradictionRecords.severity, "HARD"),
        eq(contradictionRecords.status, "PENDING"),
      ),
    )
    .limit(1);
  return Boolean(row);
}
