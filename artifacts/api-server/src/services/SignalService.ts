import { logger } from "../lib/logger.js";
import { SignalCalculationEngine } from "../engines/signal/SignalCalculationEngine.js";
import type { SignalState, SignalSnapshot } from "../types/signal.js";
import { generateId, now } from "../lib/utils.js";

const engine = new SignalCalculationEngine();
const signalCache = new Map<string, SignalState>();
const snapshotStore = new Map<string, SignalSnapshot[]>();

export const SignalService = {
  async getCurrent(userId: string): Promise<SignalState> {
    const cached = signalCache.get(userId);
    if (cached) return cached;
    const state = await engine.calculate(userId);
    signalCache.set(userId, state);
    return state;
  },

  async recalculate(userId: string): Promise<SignalState> {
    logger.info({ userId }, "SignalService.recalculate");
    const state = await engine.calculate(userId);
    signalCache.set(userId, state);
    return state;
  },

  async getHistory(userId: string): Promise<SignalSnapshot[]> {
    return snapshotStore.get(userId) ?? [];
  },

  async takeSnapshot(userId: string): Promise<SignalSnapshot> {
    const state = await SignalService.getCurrent(userId);
    const snapshot: SignalSnapshot = {
      id: generateId(),
      userId,
      momentum: state.momentum,
      consistency: state.consistency,
      velocity: state.velocity,
      condition: state.condition,
      snapshotDate: now(),
    };
    const history = snapshotStore.get(userId) ?? [];
    history.unshift(snapshot);
    snapshotStore.set(userId, history.slice(0, 30));
    return snapshot;
  },
};
