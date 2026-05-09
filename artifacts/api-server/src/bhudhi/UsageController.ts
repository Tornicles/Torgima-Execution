import { logger } from "../lib/logger.js";
import { BHUDHI_DAILY_CALL_CAPS } from "../constants/bhudhi.js";

const dailyCounts = new Map<string, number>();

/**
 * UsageController — Tracks and enforces daily Bhudhi call limits per user.
 * TODO (Prompt 3): Persist usage to database with daily reset job
 */
export class UsageController {
  canCall(userId: string): boolean {
    const key = `${userId}:${new Date().toDateString()}`;
    const count = dailyCounts.get(key) ?? 0;
    return count < BHUDHI_DAILY_CALL_CAPS.STARTER;
  }

  increment(userId: string): void {
    const key = `${userId}:${new Date().toDateString()}`;
    dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }

  getUsage(userId: string): { used: number; cap: number } {
    const key = `${userId}:${new Date().toDateString()}`;
    return {
      used: dailyCounts.get(key) ?? 0,
      cap: BHUDHI_DAILY_CALL_CAPS.STARTER,
    };
  }
}
