export type BlogCategory = "Execution" | "Goals" | "AI Systems" | "Strategy" | "Behavior";

export interface BlogPost {
  slug: string;
  title: string;
  category: BlogCategory;
  date: string;
  readMins: number;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "why-goals-fail-before-they-start",
    title: "Why goals fail before they start",
    category: "Execution",
    date: "2026-04-02",
    readMins: 6,
  },
  {
    slug: "plan-vs-system",
    title: "The difference between a plan and a system",
    category: "Strategy",
    date: "2026-03-18",
    readMins: 8,
  },
  {
    slug: "what-signals-tell-you",
    title: "What signals actually tell you about your progress",
    category: "AI Systems",
    date: "2026-03-05",
    readMins: 7,
  },
  {
    slug: "recover-from-missed-execution",
    title: "How to recover from missed execution without losing momentum",
    category: "Behavior",
    date: "2026-02-22",
    readMins: 9,
  },
  {
    slug: "blueprint-thinking",
    title: "Blueprint thinking: from vague goal to daily action",
    category: "Goals",
    date: "2026-02-08",
    readMins: 5,
  },
  {
    slug: "productivity-app-isnt-the-problem",
    title: "Why your productivity app isn't the problem",
    category: "Execution",
    date: "2026-01-29",
    readMins: 6,
  },
];
