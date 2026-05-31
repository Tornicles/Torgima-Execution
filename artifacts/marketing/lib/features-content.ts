export type FeatureMockVariant = "dashboard" | "validator" | "tasks" | "structure" | "signals";

export const DETAILED_FEATURES: {
  id: string;
  title: string;
  body: string;
  benefits: string[];
  whoFor: string;
  mock: FeatureMockVariant;
}[] = [
  {
    id: "validator",
    title: "Validate before you build. Know before you invest.",
    body: `Before Torgima generates a single task for you, it runs your idea through 12 validation stages using real market intelligence. Our Idea Validator analyzes your goal against actual market data, identifies your real competitors (not generic placeholders — actual companies you'll compete with), maps high-impact opportunities, assesses your country's economic environment, scores your execution readiness, and delivers a verdict: Go For It, Adjust Then Go, or Consider a Different Angle.

You get a complete Idea Strength Score (0-100), competitor deep dives with their strengths, weaknesses, and exactly where your idea fits relative to each one, a White Space Map showing unexploited gaps in the market, Market Timing Intelligence showing whether now is the right moment, and Revenue Model recommendations specific to your domain and location.

No other project management tool validates your idea before you execute it. Torgima does.`,
    benefits: [
      "Real competitor names and profiles (not generic descriptions)",
      "Economic environment analysis for your country",
      "Idea Strength Score with honest assessment",
      "3 optimized execution paths to choose from",
      "Full downloadable PDF report with all intelligence",
      "Execution readiness score across 5 dimensions",
    ],
    whoFor: "Founders, creators, and solopreneurs about to invest months into a new idea.",
    mock: "validator",
  },
  {
    id: "tasks",
    title: "8 tasks. Every day. Always specific to your goal.",
    body: `Every morning, Torgima generates exactly 8 tasks for you. Not random productivity advice. Not generic checklists. Tasks that are specifically written for your goal, matched to your current execution level, aligned to where you are in your project right now, and calibrated to the difficulty you've earned based on your performance history.

Each task includes: a specific action title, exact step-by-step instruction, what you'll have when it's done, a clear definition of done, why this task matters to your goal right now, and an estimated time to complete.

The system never runs out of tasks. Even if you complete all 8 — Bhudhi generates more. Even if your performance crashes — the system generates recovery tasks. An active project always has a next step.`,
    benefits: [
      "8 specific goal-aligned tasks every single day",
      "Never runs out — continuous task generation",
      "Adapts to your performance automatically",
      "Tasks linked to your complete project hierarchy",
      "Difficulty matched to your execution level",
      "Recovery tasks when performance drops",
    ],
    whoFor: "Anyone tired of staring at a blank to-do list with no idea what actually matters today.",
    mock: "tasks",
  },
  {
    id: "signals",
    title: "The truth about how you're actually executing.",
    body: `Torgima calculates your execution signal every time you complete a task and submit feedback. Your signal is not a vanity metric — it is a real-time measurement of four factors: completion rate (what percentage of your tasks you actually finish), execution quality (how well you're doing the work), momentum streak (how many consecutive days you've executed), and direction (whether your performance is improving, stable, or declining).

Your signal determines everything. It controls how many tasks you receive, what difficulty those tasks are, whether your project advances to the next stage, and how Bhudhi generates your next set of actions.

You cannot fake your signal. Torgima uses a 7-day rolling window, weights your feedback for quality, detects if you're gaming the system, and adjusts accordingly. This is what makes Torgima an execution system instead of just another to-do list.`,
    benefits: [
      "Real-time performance measurement",
      "Controls task difficulty and volume",
      "7-day rolling honest window",
      "Trend direction tracking",
      "No vanity metrics",
      "Habit-level accountability without gamification fluff",
    ],
    whoFor: "People who want honest progress tracking, not streak badges for checking boxes.",
    mock: "signals",
  },
  {
    id: "bhudhi",
    title: "An AI that lives inside your project. Not just next to it.",
    body: `Bhudhi is not a general-purpose AI. It is a purpose-built execution intelligence that is fully embedded in your project, knows your specific goal and purpose, understands your execution history, reads your current performance signals, knows which stage of your project you're in, and generates content that is always relevant to where you actually are.

Bhudhi operates across 7 intelligence zones: Reality Intelligence (market analysis), Execution Intelligence (task and project generation), Feedback Intelligence (understanding what your feedback means), Signal Intelligence (explaining your progress), Adaptation Intelligence (knowing when to change strategy), Knowledge Intelligence (building SOPs and processes from your patterns), and Governance Intelligence (explaining why certain actions are blocked).

Bhudhi cannot override the system. It cannot change your signal. It cannot give you fake progress. It operates within strict boundaries that ensure every output is honest, relevant, and safe.`,
    benefits: [
      "7 specialized intelligence zones",
      "Context-aware — never generic advice",
      "Generates tasks within governance rules",
      "Explains why actions are blocked",
      "Builds SOPs from your execution patterns",
      "Cannot lie about your progress",
    ],
    whoFor: "Builders who tried ChatGPT for planning and got advice that had nothing to do with their actual project.",
    mock: "dashboard",
  },
  {
    id: "adaptive",
    title: "The system adapts to you. Not the other way around.",
    body: `Most productivity apps require you to maintain them. Torgima maintains itself based on your actual behavior. If your performance drops, the system automatically reduces your task count, lowers the difficulty, and generates recovery tasks to help you rebuild. If your performance improves, the system increases your challenge, adds harder tasks, and expands what you're allowed to work on.

This is called Condition Control, and it has 7 states: Getting Started, Needs Attention, Rebuild Momentum, Steady Progress, Strong Execution, Peak Performance, and Shifting Gears. Each state controls exactly what types of tasks you receive, how many, at what difficulty, and what your project is allowed to do next.

No other daily planner, habit tracker, or project management app does this. They show you a list. Torgima runs a system.`,
    benefits: [
      "7 execution states with automatic transitions",
      "Task count scales with performance",
      "Recovery mode after bad weeks",
      "Challenge increases when you earn it",
      "No manual replanning required",
      "Condition Control governs all behavior",
    ],
    whoFor: "People whose productivity crashes every time life gets hard — and need a system that adjusts instead of punishing.",
    mock: "signals",
  },
  {
    id: "structure",
    title: "From goal to daily task. Every layer built automatically.",
    body: `When you launch your project, Torgima doesn't show you an empty template. It builds your complete project architecture instantly: Foundation, Validation, Growth, and Scale stages — each with specific goal milestones, sprints, steps, and actions — all the way down to your daily tasks.

Every task you complete is linked back through this structure. You can always see exactly where you are in your project, how far you've come, how many steps are ahead, and what completing today's task actually moves forward.

This is execution with full traceability. Not a collection of random tasks — a connected system where every action serves the goal.`,
    benefits: [
      "Full hierarchy: stages → sprints → steps → tasks",
      "Built automatically at launch",
      "Every task traces to your goal",
      "Milestone visibility at all times",
      "No empty templates or manual setup",
      "Stage advancement tied to signals",
    ],
    whoFor: "Project managers and founders who need structure without spending days building boards and folders.",
    mock: "structure",
  },
  {
    id: "dashboard",
    title: "One screen. Everything you need to know.",
    body: `Your dashboard shows you one thing before anything else: exactly what to do right now. Below that, you see your current execution state, your progress signals, your day streak, your project position, and any alerts.

Nothing is hidden. Nothing requires manual updating. The dashboard is automatically generated from your actual execution data. Every number you see came from something you did.

The dashboard is also mobile-first. Whether you're starting your morning routine, checking in during a break, or reviewing at the end of the day — your execution system is always with you.`,
    benefits: [
      "Today's tasks front and center",
      "Live execution state and signals",
      "Project position at a glance",
      "Mobile-first design",
      "Auto-updated — zero manual maintenance",
      "Alerts when attention is needed",
    ],
    whoFor: "Busy founders and creators who need clarity in under 30 seconds every morning.",
    mock: "dashboard",
  },
  {
    id: "report",
    title: "Your idea. Fully documented. Downloadable in one click.",
    body: `After validating your idea, every insight generated by the Idea Validator is compiled into a full PDF report. Real competitor profiles with their revenue, user base, strengths, weaknesses, and where your idea fits. Top opportunities with detailed summaries and market timing signals. Economic context for your country. Risk summary. Path comparisons. Success milestones.

This report is yours. Use it for investor conversations, partner discussions, team alignment, or just to remind yourself why you started.`,
    benefits: [
      "One-click PDF download",
      "Full competitor intelligence",
      "Opportunity and timing analysis",
      "Economic context for your region",
      "Path comparison and risk summary",
      "Shareable with investors and partners",
    ],
    whoFor: "Founders preparing for pitches, partnerships, or team buy-in before building.",
    mock: "validator",
  },
];
