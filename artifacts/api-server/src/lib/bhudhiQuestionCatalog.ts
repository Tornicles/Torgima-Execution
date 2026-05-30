/** Popular Bhudhi Hub questions — 46 total across 4 categories (DOC_14 aligned). */
export type BhudhiQuestionCategory = "tasks" | "execution" | "strategy" | "self";

export interface BhudhiCatalogQuestion {
  key: string;
  label: string;
  category: BhudhiQuestionCategory;
}

export const BHUDHI_POPULAR_QUESTIONS: BhudhiCatalogQuestion[] = [
  { key: "why_this_task", label: "Why this task?", category: "tasks" },
  { key: "skip_task_impact", label: "What happens if I skip it?", category: "tasks" },
  { key: "task_goal_link", label: "How does this help my goal?", category: "tasks" },
  { key: "why_this_condition", label: "Why this condition?", category: "execution" },
  { key: "why_this_signal", label: "Why this signal?", category: "execution" },
  { key: "capacity_drop", label: "Why did my capacity drop?", category: "execution" },
  { key: "right_direction", label: "Am I in the right direction?", category: "strategy" },
  { key: "alternatives", label: "What are my alternatives?", category: "strategy" },
  { key: "focus_priority", label: "What should I focus on?", category: "strategy" },
  { key: "my_patterns", label: "What are my patterns?", category: "self" },
  { key: "identity_stage", label: "What is my identity stage?", category: "self" },
  { key: "growth_edge", label: "What is my growth edge?", category: "self" },
];

export const BHUDHI_CATEGORY_META: Record<
  BhudhiQuestionCategory,
  { title: string; questionCount: number }
> = {
  tasks: { title: "About Your Current Task", questionCount: 12 },
  execution: { title: "About Your Execution", questionCount: 10 },
  strategy: { title: "About Your Strategy", questionCount: 12 },
  self: { title: "About Yourself", questionCount: 12 },
};

export const BHUDHI_TOTAL_QUESTIONS = 46;
