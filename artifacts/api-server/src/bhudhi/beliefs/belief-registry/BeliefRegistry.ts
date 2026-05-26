import { randomUUID } from "node:crypto";
import type { BeliefInput, BeliefKind, BeliefRecord, BeliefState } from "../contracts/types.js";

export class BeliefRegistry {
  /** Nothing becomes fact automatically — facts require evidence linkage. */
  create(params: {
    type: BeliefKind;
    statement: string;
    origin: string;
    state?: BeliefState;
    confidence?: number;
    evidence?: BeliefRecord["evidence"];
  }): BeliefRecord {
    const state = params.state ?? this.defaultState(params.type);
    return {
      beliefId: randomUUID(),
      type: params.type,
      statement: params.statement,
      origin: params.origin,
      confidence: Math.min(1, Math.max(0, params.confidence ?? 0.5)),
      evidence: params.evidence ?? [],
      state,
    };
  }

  private defaultState(type: BeliefKind): BeliefState {
    switch (type) {
      case "fact":
        return "OBSERVED";
      case "belief":
        return "INFERRED";
      case "assumption":
        return "ASSUMED";
      case "hypothesis":
        return "HYPOTHESIZED";
    }
  }

  classifyFromInput(input: BeliefInput): BeliefRecord[] {
    const items: BeliefRecord[] = [];
    const trigger = input.trigger ?? "UNKNOWN";

    if (typeof input.memory === "string" && input.memory.length > 20) {
      items.push(
        this.create({
          type: "belief",
          statement: `Memory context available for ${trigger} (${input.memory.length} chars)`,
          origin: "memory",
          state: "INFERRED",
          confidence: 0.65,
        }),
      );
    }

    if (input.signals && typeof input.signals === "object") {
      const global = String(input.signals.global ?? "neutral");
      const conf =
        typeof input.signals.confidence === "number" ? input.signals.confidence : 0.7;
      items.push(
        this.create({
          type: "fact",
          statement: `Signal state: ${global}`,
          origin: "signals",
          state: "OBSERVED",
          confidence: conf,
          evidence: [
            {
              source: "life",
              reliability: 0.8,
              recency: 1,
              agreement: 0.7,
              repeatability: 0.6,
              evidenceScore: 0.75,
              strength: "strong",
            },
          ],
        }),
      );
    }

    if (input.decision && typeof input.decision === "object") {
      const d = input.decision as Record<string, unknown>;
      if (d.explanation) {
        items.push(
          this.create({
            type: "belief",
            statement: `Decision formed: ${String(d.explanation).slice(0, 200)}`,
            origin: "decision",
            state: "VALIDATED",
            confidence: typeof d.confidence === "number" ? d.confidence : 0.7,
          }),
        );
      }
    }

    if (input.feedback) {
      items.push(
        this.create({
          type: "assumption",
          statement: "User feedback informs belief revision",
          origin: "feedback",
          state: "ASSUMED",
          confidence: 0.55,
        }),
      );
    }

    if (input.simulation) {
      items.push(
        this.create({
          type: "hypothesis",
          statement: "Simulation scenario may alter expected outcomes",
          origin: "simulation",
          state: "HYPOTHESIZED",
          confidence: 0.45,
        }),
      );
    }

    if (input.research && Object.keys(input.research).length > 0) {
      items.push(
        this.create({
          type: "belief",
          statement: `Research context: ${Object.keys(input.research).slice(0, 5).join(", ")}`,
          origin: "research",
          state: "INFERRED",
          confidence: 0.6,
        }),
      );
    }

    if (items.length === 0) {
      items.push(
        this.create({
          type: "assumption",
          statement: `Insufficient epistemic input for ${trigger} — operating with bounded uncertainty`,
          origin: "system",
          state: "ASSUMED",
          confidence: 0.35,
        }),
      );
    }

    return items;
  }

  transition(record: BeliefRecord, newState: BeliefState): BeliefRecord {
    return { ...record, state: newState };
  }
}

export const beliefRegistry = new BeliefRegistry();
