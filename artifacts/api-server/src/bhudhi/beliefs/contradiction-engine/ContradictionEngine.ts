import type { BeliefRecord, ContradictionResult } from "../contracts/types.js";

export class ContradictionEngine {
  detect(records: BeliefRecord[]): ContradictionResult[] {
    const conflicts: ContradictionResult[] = [];

    const facts = records.filter((r) => r.type === "fact");
    const assumptions = records.filter((r) => r.type === "assumption");

    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        const a = facts[i]!;
        const b = facts[j]!;
        if (this.statementsConflict(a.statement, b.statement)) {
          conflicts.push({
            conflictType: "memory",
            description: `Conflicting facts: "${a.statement.slice(0, 60)}" vs "${b.statement.slice(0, 60)}"`,
            action: "investigate",
            beliefIdA: a.beliefId,
            beliefIdB: b.beliefId,
          });
        }
      }
    }

    for (const f of facts) {
      for (const a of assumptions) {
        if (
          f.statement.toLowerCase().includes("danger") &&
          a.statement.toLowerCase().includes("optimal")
        ) {
          conflicts.push({
            conflictType: "execution",
            description: "Danger signal conflicts with optimistic assumption",
            action: "escalate",
            beliefIdA: f.beliefId,
            beliefIdB: a.beliefId,
          });
        }
      }
    }

    const lowConf = records.filter((r) => r.confidence < 0.3 && r.type === "belief");
    if (lowConf.length >= 2) {
      conflicts.push({
        conflictType: "research",
        description: "Multiple low-confidence beliefs — epistemic instability",
        action: "freeze",
      });
    }

    return conflicts;
  }

  resolveAction(conflict: ContradictionResult): "freeze" | "investigate" | "escalate" | "resolve" {
    return conflict.action;
  }

  private statementsConflict(a: string, b: string): boolean {
    const neg = (s: string) =>
      /\b(not|no|never|danger|blocked|failed)\b/i.test(s);
    return neg(a) !== neg(b) && a.slice(0, 30) !== b.slice(0, 30);
  }
}

export const contradictionEngine = new ContradictionEngine();
