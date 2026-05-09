import { logger } from "../lib/logger.js";
import { generateId, now } from "../lib/utils.js";

export interface User {
  id: string;
  email: string;
  name: string;
  onboardingCompleted: boolean;
  timezone: string | null;
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  dailyTaskTarget: number;
  notificationsEnabled: boolean;
  weeklyReviewDay: string | null;
}

// In-memory stub for Prompt 1 — replaced by UserRepository in Prompt 3
const users = new Map<string, User>();
const settings = new Map<string, UserSettings>();

function seedDemoUser(): User {
  const id = "demo-user-001";
  if (!users.has(id)) {
    const user: User = {
      id,
      email: "demo@torgima.com",
      name: "Demo User",
      onboardingCompleted: false,
      timezone: "UTC",
      createdAt: now(),
    };
    users.set(id, user);
    settings.set(id, {
      userId: id,
      dailyTaskTarget: 3,
      notificationsEnabled: true,
      weeklyReviewDay: "sunday",
    });
  }
  return users.get(id)!;
}

export const UserService = {
  getDemoUser(): User {
    return seedDemoUser();
  },

  async get(id: string): Promise<User | null> {
    return users.get(id) ?? null;
  },

  async update(id: string, patch: Partial<Pick<User, "name" | "timezone">>): Promise<User | null> {
    const u = users.get(id);
    if (!u) return null;
    const updated = { ...u, ...patch };
    users.set(id, updated);
    return updated;
  },

  async getSettings(userId: string): Promise<UserSettings> {
    return settings.get(userId) ?? {
      userId,
      dailyTaskTarget: 3,
      notificationsEnabled: true,
      weeklyReviewDay: null,
    };
  },

  async updateSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
    const current = await UserService.getSettings(userId);
    const updated = { ...current, ...patch, userId };
    settings.set(userId, updated);
    return updated;
  },

  async completeOnboarding(userId: string): Promise<void> {
    const u = users.get(userId);
    if (u) users.set(userId, { ...u, onboardingCompleted: true });
  },
};
