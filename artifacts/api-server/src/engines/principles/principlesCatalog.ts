/**
 * 365 unique execution principles (Management Volume–aligned catalog).
 * Seeded via scripts/seed-principles-365.mjs — one non-repeating law per calendar day slot.
 */

export type PrincipleCatalogRow = {
  dayNumber: number;
  principleStatement: string;
  principleRules: string[];
  philosophy: string;
  tensionPoints: string;
  managementVolumeSource: string;
  keywords: string[];
};

const EXECUTION_LAWS = [
  { theme: "Clarity before action", tension: "ambiguity paralysis", verbs: ["define the next step", "name the constraint", "write the decision"] },
  { theme: "Proof over intention", tension: "false progress", verbs: ["capture evidence", "verify completion", "document output"] },
  { theme: "Constraint creates focus", tension: "scope drift", verbs: ["limit work in progress", "finish before starting", "protect the deadline"] },
  { theme: "Recovery is execution", tension: "burnout collapse", verbs: ["reduce load deliberately", "restore capacity", "reset expectations"] },
  { theme: "Dependency first", tension: "blocked work", verbs: ["clear blockers", "sequence prerequisites", "ask for access early"] },
  { theme: "Honest failure", tension: "gaming metrics", verbs: ["report truth", "classify the miss", "adjust the plan"] },
  { theme: "Momentum compounds", tension: "inconsistent effort", verbs: ["ship something small", "close the loop", "chain tomorrow's start"] },
  { theme: "Priority is sacrifice", tension: "wrong work", verbs: ["cut low-value tasks", "protect the critical path", "say no explicitly"] },
  { theme: "Reflection closes loops", tension: "unlearned mistakes", verbs: ["review outcomes", "extract one lesson", "update the blueprint"] },
  { theme: "Accountability is public", tension: "private excuses", verbs: ["share proof", "make commitments visible", "invite scrutiny"] },
] as const;

const CONDITION_KEYWORDS: Record<string, string[]> = {
  danger: ["recovery", "constraint", "honest", "dependency"],
  nothingness: ["clarity", "momentum", "proof", "priority"],
  urgency: ["priority", "constraint", "proof", "momentum"],
  stability: ["reflection", "momentum", "proof", "clarity"],
  power: ["priority", "momentum", "accountability", "proof"],
  affluence: ["reflection", "priority", "constraint", "accountability"],
};

function rulesFor(theme: string, day: number): string[] {
  return [
    `Before noon, apply today's law of ${theme.toLowerCase()} to one active order.`,
    `Document proof of application (text, photo, or reflection) before day end.`,
    `If blocked for more than 30 minutes, escalate as a dependency — do not spin.`,
    `Link the application to at least one execution artifact (order or feedback).`,
    `Day ${day}: no principle without observable behavior change.`,
  ];
}

export function buildPrincipleCatalog(): PrincipleCatalogRow[] {
  const rows: PrincipleCatalogRow[] = [];
  for (let day = 1; day <= 365; day++) {
    const law = EXECUTION_LAWS[(day - 1) % EXECUTION_LAWS.length]!;
    const verb = law.verbs[day % law.verbs.length]!;
    const statement = `${law.theme}: ${verb} today.`;
    const keywords = [
      law.theme.split(" ")[0]!.toLowerCase(),
      law.tension.replace(/\s/g, "_"),
      `day_${day}`,
      ...Object.entries(CONDITION_KEYWORDS).filter(([, kws]) =>
        kws.some((k) => law.theme.toLowerCase().includes(k.split("_")[0] ?? k)),
      ).map(([c]) => c),
    ];

    rows.push({
      dayNumber: day,
      principleStatement: statement,
      principleRules: rulesFor(law.theme, day),
      philosophy: `Operational law ${day} — ${law.theme} reduces ${law.tension} during execution.`,
      tensionPoints: law.tension,
      managementVolumeSource: `Management Volume — Execution Law ${day} (${law.theme})`,
      keywords: [...new Set(keywords)],
    });
  }
  return rows;
}

export function scorePrincipleForCondition(
  keywords: string[],
  condition: string,
  executionBlocker: string,
): number {
  let score = 0;
  const condKeys = CONDITION_KEYWORDS[condition] ?? [];
  for (const k of keywords) {
    if (condKeys.some((c) => k.includes(c))) score += 3;
    if (executionBlocker && k.includes(executionBlocker.slice(0, 8).toLowerCase())) score += 2;
  }
  return score;
}
