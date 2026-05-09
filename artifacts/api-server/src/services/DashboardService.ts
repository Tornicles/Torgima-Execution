import { logger } from "../lib/logger.js";
import { UserService } from "./UserService.js";
import { BlueprintService } from "./BlueprintService.js";
import { OrderService } from "./OrderService.js";
import { FeedbackService } from "./FeedbackService.js";
import { SignalService } from "./SignalService.js";

export const DashboardService = {
  async getDashboardState(userId: string) {
    logger.info({ userId }, "DashboardService.getDashboardState");

    const [user, blueprints, activeOrders, signals, recentFeedback] = await Promise.all([
      UserService.getDemoUser(),
      BlueprintService.list(userId),
      OrderService.getActive(userId),
      SignalService.getCurrent(userId),
      FeedbackService.getRecent(userId, 5),
    ]);

    const activeBlueprint = blueprints.find((b) => b.status === "active") ?? null;

    const completedToday = recentFeedback.filter((f) => {
      const today = new Date().toDateString();
      return new Date(f.createdAt).toDateString() === today;
    }).length;

    const completedThisWeek = recentFeedback.filter((f) => {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return new Date(f.createdAt).getTime() > weekAgo;
    }).length;

    return {
      user,
      signals,
      activeBlueprint,
      activeOrders,
      recentFeedback,
      streakDays: signals.streak,
      tasksCompletedToday: completedToday,
      tasksCompletedThisWeek: completedThisWeek,
    };
  },
};
