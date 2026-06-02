/**
 * Phase 3 DOC 19 — canonical path (implementation in reward/).
 */
export {
  evaluateReward,
  getLatestRewardForBlueprint,
  getPendingRewards,
  getRecentRewards,
  markRewardsDelivered,
  type RewardType,
} from "../reward/RewardEngine.js";

export {
  computeStreaks,
  type ExecutionStreaks,
} from "../reward/StreakTracker.js";
