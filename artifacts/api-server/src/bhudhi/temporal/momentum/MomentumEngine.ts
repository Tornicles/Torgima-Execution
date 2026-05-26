import type { MomentumMode, MomentumResult, TemporalInput } from "../contracts/types.js";

export class MomentumEngine {
  track(input: TemporalInput): MomentumResult {
    const velocity =
      typeof input.execution?.velocity === "number"
        ? input.execution.velocity
        : input.signals?.momentum
          ? Number(input.signals.momentum)
          : 0.5;

    const consistency =
      typeof input.memory === "object" && input.memory?.streak
        ? Math.min(1, Number(input.memory.streak) / 10)
        : 0.5;

    const fatigue = input.life?.burnout || input.identity?.burnout ? 0.7 : 0.2;
    const acceleration = velocity > 0.6 && consistency > 0.55 ? 0.15 : -0.05;

    let trajectory: MomentumMode = "STABLE";
    if (velocity > 0.7 && acceleration > 0) trajectory = "RISING";
    else if (velocity < 0.35 || fatigue > 0.6) trajectory = "DECLINING";
    else if (velocity < 0.2 && fatigue > 0.75) trajectory = "COLLAPSING";

    const momentum = Math.max(0, Math.min(1, velocity * 0.5 + consistency * 0.3 + (1 - fatigue) * 0.2));
    const risk = fatigue + (trajectory === "COLLAPSING" ? 0.3 : 0);

    return { momentum, risk, trajectory, velocity, consistency };
  }
}

export const momentumEngine = new MomentumEngine();
