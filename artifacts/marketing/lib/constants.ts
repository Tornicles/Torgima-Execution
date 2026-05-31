export const STATS = {
  users: 2400,
  tasksCompleted: 47000,
  validations: 8900,
  avgRating: 4.9,
} as const;

export const PRICING = {
  starter: { name: "Starter", monthly: 9, annual: 6, freeTier: true },
  growth: { name: "Growth", monthly: 29, annual: 20, popular: true },
  ultimate: { name: "Ultimate", monthly: 79, annual: 55 },
} as const;
