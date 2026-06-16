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
    perDay: (count: number) => `${count} tasks/day`,
    easyPlural: "Easy tasks",
    allTypes: "All task types",
    dailyFallback: "Daily tasks",
    difficultyFallback: "Task difficulty",
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
    blockedTitle: "This step is blocked",
    blockedHint: "Resolve the blocker below or return to your dashboard for the next action.",
    finishedTask: "I finished this task",
    hitProblem: "I hit a problem",
    triedFailed: "I tried but could not complete it",
    backToDashboard: "Back to Dashboard",
    needsFeedbackPrompt: "This task is waiting for your update — share what happened.",
    expectedOutputLabel: "Expected Output",
    definitionOfDoneLabel: "Definition of Done",
    proofWillNeed: "You will need to submit:",
    completionSummaryLabel: "What you reported",
  },
  feedback: {
    title: "How Did It Go?",
    subtitle: "Your honest feedback helps the system give you better tasks.",
    completionLabel: "How did it go?",
    selectCompletion: "Select how this step went.",
    proofRequired: "Evidence",
    proofRequiredMessage: "Please provide the required proof before submitting.",
    proofTextPlaceholder: "Describe what you did and the outcome (at least 20 characters).",
    minCharacters: "characters minimum",
    uploadProof: "Upload file",
    uploading: "Uploading…",
    uploadFailed: "Upload failed — try again.",
    invalidLink: "Enter a valid http or https link.",
    optionalContext: "Optional context",
    effortLabel: "How hard did you push?",
    frictionLabel: "How much resistance did you face?",
    confidenceLabel: "How confident are you in the result?",
    durationLabel: "How long did this take? (minutes)",
    notesPlaceholder: "Anything else to add? (optional)",
    blockerDescribe: "What blocked you?",
    blockerRequired: "Describe what blocked progress.",
    staleRetry: "Your session refreshed — please try again.",
    offline:
      "You appear to be offline. Your answers are saved on this device — submit when you are back online.",
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
    processing: "Processing your update...",
    reflectionTooShort: "Please describe your work in more detail",
    reflectionHintDetail:
      "Describe the actual work done, not just that you did it",
    scoreFailed: "Failed",
    scoreAcceptable: "Acceptable",
    scoreExcellent: "Excellent",
    proofLinkPlaceholder: "Or paste a link to your work",
    proofUploadIdle: "Upload proof of completion",
    proofUploaded: "Uploaded",
    submitted: "Feedback received. Preparing your next task...",
    interrogation: {
      title: "One Quick Question",
      subtitle:
        "A bit more detail would help us record your progress accurately.",
      detailLabel: "Add more detail",
      detailPlaceholder: "Share what you did and what changed…",
      submit: "Submit additional detail",
      submitting: "Submitting…",
      minDetail: "Please add at least 30 characters of detail.",
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
  signalsPanel: {
    freshness: {
      live: "Live",
      recent: "Recent",
      warming: "Warming — tap to refresh",
      stale: "Data may be outdated",
      outdated: "Signal data may be outdated",
      updating: "Updating...",
    },
    explain: "How is this calculated?",
    explainError: "Explanation could not be generated",
    healthScore: "Health Score",
    workQuality: "Work Quality",
    momentumDays: "Momentum",
    direction: "Direction",
    updatedAgo: (label: string) => `Updated ${label}`,
    dataMayBeOutdated: "Data may be outdated",
    signalDataOutdated: "Signal data may be outdated",
    noDataYet: "Executing tasks will populate your health scores",
    healthUnavailable: "Health data is temporarily unavailable",
    systemUpdating: "System is updating",
    retry: "Retry",
    conditionDuration: (label: string, days: number) =>
      `You have been ${label} for ${days} day${days === 1 ? "" : "s"}`,
    comingSoon: "Coming soon",
    daysActiveMonth: "Days active this month",
    milestonesCompleted: "Milestones completed",
    currentStreak: "Current streak",
    streakDays: (n: number) => `${n} day${n === 1 ? "" : "s"}`,
    nextStage: (name: string) => `Next: ${name}`,
    explainUnavailable:
      "Explanation unavailable — the system is processing. Try again in a moment.",
    signalLabels: {
      completion_rate: "Completion Rate",
      score: "Execution Quality",
      momentum: "Momentum",
      trend: "Trend Direction",
      confidence: "Signal Confidence",
      consistency: "Consistency",
      fatigue_risk: "Fatigue Risk",
    },
    signalExplain: {
      completion_rate: "How often you complete assigned tasks in the current window.",
      score: "Quality of your execution feedback scores over recent tasks.",
      momentum: "Whether your completion pace is accelerating or slowing.",
      trend: "Overall direction of your execution metrics this week.",
      confidence: "How much verified data the system has to interpret your signals.",
      consistency: "How regularly you show up and submit feedback.",
      fatigue_risk: "Whether blockers and skips suggest you need a lighter load.",
    },
    conditionAvailable: "Available now",
    conditionLimited: "Temporarily limited",
    conditionUnlock: "To unlock",
    identityTitle: "Execution identity",
    evidencePrefix: "Based on",
    growthEdgePrefix: "What consistently showing up will build toward",
  },
  identity: {
    stages: {
      UNFORMED: {
        label: "Finding Your Direction",
        description: "You're establishing what you're building toward.",
      },
      INITIATING: {
        label: "Getting Started",
        description: "Early execution cycles are forming your baseline.",
      },
      BUILDING: {
        label: "Building Momentum",
        description: "Repeated completion is strengthening your execution rhythm.",
      },
      STABILIZING: {
        label: "Finding Your Rhythm",
        description: "Your pace is becoming predictable and reliable.",
      },
      EXPANDING: {
        label: "Growing Your Capacity",
        description: "The system can offer more challenge because you've earned it.",
      },
      INTEGRATED: {
        label: "Fully Operational",
        description: "Strong, verified execution across your active blueprint.",
      },
      REGRESSING: {
        label: "Recovering",
        description: "Your pace has slowed recently — recovery tasks take priority.",
      },
      RESTARTING: {
        label: "Starting Again",
        description: "You're re-entering execution after a pause or pivot.",
      },
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
      PROCEED: { label: "Proceed", color: "#10B981", icon: "✓" },
      ADJUST: { label: "Needs Adjustment", color: "#F59E0B", icon: "→" },
      PIVOT: { label: "Change Direction", color: "#EF4444", icon: "↺" },
      proceed: { label: "Proceed", color: "#10B981", icon: "✓" },
      adjust: { label: "Needs Adjustment", color: "#F59E0B", icon: "→" },
      pivot: { label: "Change Direction", color: "#EF4444", icon: "↺" },
    },
    strengthScore: "Idea Strength Score",
    download: "Download Full Report",
    launching: "Launching Your Project...",
    launchButton: "Launch This Direction",
    launchSubtext: "Start your execution plan and get your first tasks",
    launchBlocked: "Launch Blocked",
    pivotBlocked:
      "Project launch is blocked until direction changes. Edit your goal or select a recovery path, then re-analyze.",
  },
  onboarding: {
    stepLabels: ["Your Idea", "Your Context", "Review", "Analysis"],
    welcomeTitle: "Build your execution system",
    welcomeSubtitle:
      "Turn what you want to achieve into a clear daily path. This takes a few minutes — we will guide you step by step.",
    beginButton: "Begin",
    goalTitle: "What Do You Want to Build?",
    goalSubtitle:
      "Describe your main goal clearly. The more specific you are, the better your execution plan will be.",
    goalLabel: "Your Goal",
    goalPlaceholder: "What do you want to achieve in the next 90 days?",
    purposeLabel: "Your Why",
    purposeTitle: "Why Does This Matter to You?",
    purposePlaceholder: "Why does this matter to you right now?",
    contextTitle: "Tell Us About Your Situation",
    reviewTitle: "Review Everything",
    reviewSubtitle: "Confirm your information before we analyze your idea.",
    validateButton: "✦ Analyze My Idea",
    continueButton: "Continue →",
    saveButton: "Save Draft",
    structuringLabel: "Building your execution system...",
    structuringHint: "Organizing your goal, purpose, and constraints.",
    clarificationKicker: "One more detail",
    clarificationTitle: "Help us sharpen your direction",
    clarificationDefault: "Add a short, specific answer.",
    clarificationPlaceholder: "Your answer…",
    clarificationTooShort: "Please add at least a few characters.",
    invalidGoalTitle: "Your goal needs more specificity",
    invalidGoalHint:
      "Describe a clear outcome or direction we can turn into daily execution. Then try again.",
    editGoalButton: "Edit your goal",
    bhudhiFallbackHint:
      "We could not reach the structuring service. You can continue with what you entered.",
    activateButton: "Start My Execution System",
    activatingLabel: "Building your execution system...",
    tierRequired: "Please select an execution level first.",
    summaryTitle: "Your execution direction",
  },
  dashboard: {
    title: "Dashboard",
    welcome: "Welcome back",
    noProject: "You don't have a project yet.",
    startProject: "Validate and Launch Your First Project",
    lockTitle: "System maintenance",
    lockBody: "Your execution system is being repaired. Your progress is safe.",
    lockHint: "This usually resolves in under a minute.",
    pendingTask: "Preparing your next task...",
    pendingTaskHint: "Your direction is active. The next step will appear shortly.",
    noTaskYet: "Your next task is being prepared.",
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
  actions: {
    refresh: "Refresh",
    retry: "Try again",
    back: "Back",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    boundaryHint: "Something went wrong. Your progress is safe on the server.",
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

/** Re-export for UI files audited by phase6 (must not reference LANGUAGE.task in source). */
export const EXECUTION_UNIT = LANGUAGE.task;

/** DOC 31 — never show raw engine terms in UI; use these labels instead. */
export const INTERNAL_TERM_LABELS = {
  blueprint: LANGUAGE.project.singular,
  order: LANGUAGE.task.singular,
  orders: LANGUAGE.task.plural,
  nothingness: LANGUAGE.condition.states.nothingness.label,
  danger: LANGUAGE.condition.states.danger.label,
  urgency: LANGUAGE.condition.states.urgency.label,
  stability: LANGUAGE.condition.states.stability.label,
  power: LANGUAGE.condition.states.power.label,
  affluence: LANGUAGE.condition.states.affluence.label,
  power_change: LANGUAGE.condition.states.power_change.label,
  enforcement_package: "Execution Settings",
  signal_snapshot: LANGUAGE.progress.title,
  condition: LANGUAGE.condition.title,
} as const;
