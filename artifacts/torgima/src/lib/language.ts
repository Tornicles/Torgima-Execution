// TORGIMA LANGUAGE LAYER — single source for user-facing copy.

export const LANGUAGE = {
  project: {
    singular: "project",
    plural: "projects",
    your: "your project",
    active: "active project",
    draft: "project draft",
    overview: "Project Overview",
    launch: "Launch My Project",
    launching: "Launching your project...",
    launched: "Project launched successfully!",
    position: "Where You Are",
    namePlaceholder: "e.g. My SaaS Business, Agency Launch, Creator Brand",
    nameLabel: "Give your project a name",
    nameHint: "This is how your project will appear on your dashboard.",
    nameSectionTitle: "GIVE YOUR PROJECT A NAME",
    yourProject: "YOUR PROJECT",
    editName: "Edit Name",
    rename: "Rename",
    noProject: "You don't have an active project yet.",
    startProject: "Start Your Project",
  },
  task: {
    singular: "task",
    plural: "tasks",
    today: "Today's Task",
    upcoming: "Upcoming Tasks",
    completed: "Completed Tasks",
    inProgress: "Task In Progress",
    list: "Task List",
    next: "Next Task",
    current: "Current Task",
    start: "Start Task",
    complete: "Mark as Done",
    pause: "Pause Task",
    block: "Something Is Blocking Me",
    resume: "Resume Task",
    viewDetails: "View Task Details",
    preparing: "Preparing your next tasks...",
    noTasks: "No tasks available right now.",
    difficulty: {
      very_easy: "Quick Win",
      easy: "Easy",
      moderate: "Medium",
      hard: "Challenging",
      very_hard: "Advanced",
    },
    type: {
      execution: "Execution Task",
      recovery: "Getting Back on Track",
      academy: "Learning Task",
      clarification: "Quick Question",
      weekly_review: "Weekly Review",
      phase_checkpoint: "Stage Review",
    },
    completion: {
      completed: "Done",
      partial: "Partially Done",
      skipped: "Skipped",
      blocked: "Blocked",
    },
  },
  feedback: {
    title: "How Did It Go?",
    subtitle: "Your honest feedback helps the system give you better tasks.",
    scoreLabel: "How would you rate this task?",
    scoreLow: "It was very difficult",
    scoreHigh: "It went great",
    difficultyLabel: "How did the difficulty feel?",
    reflectionLabel: "What happened?",
    reflectionPlaceholder:
      "What did you actually do? What was the result? Be specific.",
    reflectionHint:
      "The more specific you are, the better your next task will be.",
    blockerLabel: "Did something get in the way?",
    blockerTypeLabel: "What stopped you?",
    blockerTypes: {
      capability_gap: "I didn't have the knowledge or skill",
      external_dependency: "I was waiting on something outside my control",
      capacity: "I ran out of time or energy",
      technical: "A technical problem blocked me",
      resource: "I didn't have what I needed",
      other: "Something else",
    },
    submit: "Submit Feedback",
    submitting: "Saving your feedback...",
    submitted: "Feedback received. Preparing your next task...",
    interrogation: {
      title: "One Quick Question",
      subtitle: "Help us understand your progress better.",
    },
  },
  progress: {
    title: "Your Progress",
    completionRate: "Tasks Completed",
    executionQuality: "Execution Quality",
    streak: "Day Streak",
    direction: "Direction",
    noData: "No progress data yet. Complete your first task to get started.",
    direction_values: {
      improving: "↑ Improving",
      declining: "↓ Declining",
      stable: "→ Steady",
      recovering: "↗ Recovering",
      none: "— Not enough data yet",
      flat: "→ Steady",
    },
  },
  condition: {
    title: "Your Execution State",
    states: {
      nothingness: {
        label: "Getting Started",
        emoji: "🌱",
        description:
          "You're just getting going. Complete your first tasks to build momentum.",
        color: "#6B7280",
        nextStep: "Complete your first task and tell us how it went.",
      },
      danger: {
        label: "Needs Attention",
        emoji: "⚠️",
        description:
          "Your execution has slowed down. Let's get back on track with small, easy wins.",
        color: "#EF4444",
        nextStep: "Complete one easy task today to start rebuilding.",
      },
      urgency: {
        label: "Rebuild Momentum",
        emoji: "🔄",
        description:
          "You're working but need more consistency. Keep going — you're close.",
        color: "#F59E0B",
        nextStep: "Complete tasks 3 days in a row to build your streak back.",
      },
      stability: {
        label: "Steady Progress",
        emoji: "✅",
        description:
          "You're executing consistently. The system is giving you more to work with.",
        color: "#10B981",
        nextStep: "Keep your consistency going to unlock more challenging tasks.",
      },
      power: {
        label: "Strong Execution",
        emoji: "⚡",
        description:
          "Excellent work. You're executing at a high level and getting harder tasks.",
        color: "#6366F1",
        nextStep: "Maintain your streak to reach peak performance.",
      },
      affluence: {
        label: "Peak Performance",
        emoji: "🚀",
        description:
          "You are executing at the highest level. The system is giving you maximum challenge.",
        color: "#8B5CF6",
        nextStep: "You're at peak performance. Scale and systemize your operations.",
      },
      power_change: {
        label: "Shifting Gears",
        emoji: "↕️",
        description:
          "Your execution level is changing. Stay focused during the transition.",
        color: "#F59E0B",
        nextStep: "Keep executing consistently to stabilize at your new level.",
      },
    },
  },
  hierarchy: {
    stage: "Stage",
    currentStage: "Current Stage",
    sprint: "Sprint",
    currentSprint: "Current Sprint",
    step: "Step",
    currentStep: "Current Step",
    goalMilestone: "Goal Milestone",
    progress: "Progress",
    stageComplete: "Stage Complete",
    nextStage: "Next Stage",
    allStagesComplete: "All stages complete! Your project is done.",
    executionPosition: "Where You Are",
    plans: {
      Foundation: "Foundation",
      "Validation / Proof": "Validation",
      Growth: "Growth",
      Scale: "Scale",
    } as Record<string, string>,
  },
  validation: {
    title: "Idea Validator",
    analyzing: "Analyzing Your Idea",
    analyzingSubtitle:
      "We're checking your idea against real market data, competition, and execution reality.",
    resultsTitle: "Your Idea Report",
    resultsSubtitle: "Here's what we found and what we recommend.",
    backToValidator: "Back to Idea Validator",
    verdicts: {
      PROCEED: { label: "Go For It", color: "#10B981", icon: "✓" },
      ADJUST: { label: "Adjust Then Go", color: "#F59E0B", icon: "→" },
      PIVOT: { label: "Consider a Different Angle", color: "#EF4444", icon: "↺" },
      proceed: { label: "Go For It", color: "#10B981", icon: "✓" },
      adjust: { label: "Adjust Then Go", color: "#F59E0B", icon: "→" },
      pivot: { label: "Consider a Different Angle", color: "#EF4444", icon: "↺" },
    },
    strengthScore: "Idea Strength Score",
    download: "Download Full Report",
    launching: "Launching Your Project...",
    launchButton: "🚀 Launch This Project",
    launchSubtext: "Start your execution plan and get your first tasks",
    launchBlocked: "Launch Blocked",
    pivotBlocked:
      "Project launch is blocked until direction changes. Edit your goal or select a recovery path, then re-analyze.",
  },
  onboarding: {
    stepLabels: ["Your Idea", "Your Context", "Review", "Analysis"],
    goalTitle: "What Do You Want to Build?",
    goalSubtitle:
      "Describe your main goal clearly. The more specific you are, the better your execution plan will be.",
    goalLabel: "Your Goal",
    goalPlaceholder: "Describe your main goal in one clear statement.",
    purposeLabel: "Your Why",
    purposeTitle: "Why Does This Matter to You?",
    purposePlaceholder:
      "Explain why this goal is important and what you want to achieve.",
    contextTitle: "Tell Us About Your Situation",
    reviewTitle: "Review Everything",
    reviewSubtitle: "Confirm your information before we analyze your idea.",
    validateButton: "✦ Analyze My Idea",
    continueButton: "Continue →",
    saveButton: "Save Draft",
  },
  dashboard: {
    title: "Dashboard",
    welcome: "Welcome back",
    noProject: "You don't have a project yet.",
    startProject: "Validate and Launch Your First Project",
    currentTaskTitle: "What To Do Now",
    projectProgress: "Project Progress",
    weeklyStreak: "Day Streak",
    tasksThisWeek: "Tasks This Week",
    loading: "Loading your dashboard...",
    refreshing: "Updating...",
    stale: "Your dashboard is updating...",
    viewProject: "View My Project →",
  },
  nav: {
    home: "Home",
    tasks: "My Tasks",
    project: "My Project",
    progress: "My Progress",
    bhudhi: "Bhudhi",
    erector: "Idea Validator",
    signals: "My Progress",
    settings: "Settings",
    academy: "Academy",
    messages: "Messages",
    community: "Community",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    notFound: "We couldn't find what you were looking for.",
    unauthorized: "Please sign in to continue.",
    serverBusy: "We're a bit busy right now. Please try again in a moment.",
    taskNotAvailable: "This task isn't available right now.",
    feedbackRequired: "Please complete the feedback form to continue.",
    reflectionTooShort: "Please describe what happened in at least 10 characters.",
    noProject: "Start by validating your idea and launching your project.",
    projectNameRequired: "Give your project a name (at least 3 characters).",
    projectNameInvalid:
      "Use letters, numbers, spaces, hyphens, apostrophes, or & only.",
    projectNameTooLong: "Project name must be 50 characters or fewer.",
    launchFailed: "We couldn't start your project. Please try again.",
  },
  states: {
    loading: "Loading...",
    saving: "Saving...",
    preparing: "Preparing...",
    processing: "Processing your feedback...",
    generating: "Preparing your next tasks...",
    complete: "Done!",
    locked: "This action isn't available right now.",
    blocked: "Something is blocking this. Let's solve it.",
    recovering: "Getting back on track...",
  },
} as const;

export type ConditionDisplay = {
  label: string;
  emoji: string;
  description: string;
  color: string;
  nextStep: string;
};

export function getConditionLabel(condition: string): ConditionDisplay {
  const key = condition.toLowerCase().replace(/\s+/g, "_") as keyof typeof LANGUAGE.condition.states;
  return LANGUAGE.condition.states[key] ?? LANGUAGE.condition.states.nothingness;
}

export function getDifficultyLabel(difficulty: string): string {
  const key = difficulty as keyof typeof LANGUAGE.task.difficulty;
  return LANGUAGE.task.difficulty[key] ?? difficulty;
}

export function getCompletionLabel(completion: string): string {
  const key = completion as keyof typeof LANGUAGE.task.completion;
  return LANGUAGE.task.completion[key] ?? completion;
}

export function getProjectDisplayName(
  projectName: string | null | undefined,
  goal: string | null | undefined,
): string {
  if (projectName && projectName.trim().length > 0) return projectName.trim();
  if (goal) return goal.substring(0, 40) + (goal.length > 40 ? "..." : "");
  return "My Project";
}

export function getVerdictDisplay(verdict: string): {
  label: string;
  color: string;
  icon: string;
} {
  const key = verdict.toUpperCase() as keyof typeof LANGUAGE.validation.verdicts;
  const lower = verdict.toLowerCase() as keyof typeof LANGUAGE.validation.verdicts;
  return (
    LANGUAGE.validation.verdicts[key] ??
    LANGUAGE.validation.verdicts[lower] ?? {
      label: verdict,
      color: "#6B7280",
      icon: "?",
    }
  );
}

export function getPlanLabel(planName: string): string {
  return LANGUAGE.hierarchy.plans[planName] ?? planName;
}

export function getTrendLabel(trend: string | null | undefined): string {
  if (!trend) return LANGUAGE.progress.direction_values.none;
  const key = trend as keyof typeof LANGUAGE.progress.direction_values;
  return LANGUAGE.progress.direction_values[key] ?? trend;
}
