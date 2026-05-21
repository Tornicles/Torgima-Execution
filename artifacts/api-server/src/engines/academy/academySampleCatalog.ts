/**
 * Sample Erector Academy courses (PROMPT 2 Stage 1 seed).
 */

export type SampleCourse = {
  title: string;
  description: string;
  category: string;
  difficultyLevel: "beginner" | "intermediate" | "advanced";
  estimatedDurationHours: number;
  chapters: {
    title: string;
    description: string;
    objectives: string[];
    lessons: {
      title: string;
      contentType: string;
      contentBody: string;
      keyConcepts: string[];
      readingTimeMinutes: number;
      practice: {
        question: string;
        options?: Record<string, string>;
        correctAnswer: string;
        explanation: string;
        difficulty: number;
      };
    }[];
  }[];
};

export const SAMPLE_ACADEMY_COURSES: SampleCourse[] = [
  {
    title: "Execution Fundamentals",
    description: "Operational laws for daily execution: clarity, proof, and recovery.",
    category: "business",
    difficultyLevel: "beginner",
    estimatedDurationHours: 8,
    chapters: [
      {
        title: "Clarity Before Action",
        description: "Define constraints and next steps before work begins.",
        objectives: ["Name constraints", "Write the next executable step"],
        lessons: [
          {
            title: "The Clarity Law",
            contentType: "text",
            contentBody:
              "Ambiguity is the primary execution tax. Before any task, write one sentence: what done looks like and what blocks removal requires.",
            keyConcepts: ["clarity", "constraint", "next-step"],
            readingTimeMinutes: 12,
            practice: {
              question: "What is the first clarity action before starting work?",
              options: { a: "Add more tasks", b: "Define done and blockers", c: "Skip planning" },
              correctAnswer: "b",
              explanation: "Defining done and blockers removes ambiguity paralysis.",
              difficulty: 2,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Marketing Funnels for Operators",
    description: "Build measurable funnels tied to execution outcomes.",
    category: "marketing",
    difficultyLevel: "intermediate",
    estimatedDurationHours: 12,
    chapters: [
      {
        title: "Funnel Anatomy",
        description: "Stages, metrics, and proof at each step.",
        objectives: ["Map funnel stages", "Attach proof metrics"],
        lessons: [
          {
            title: "Stage Proof",
            contentType: "case-study",
            contentBody:
              "Each funnel stage must have observable proof: traffic → capture → nurture → conversion. No stage without a metric.",
            keyConcepts: ["funnel", "proof", "metrics"],
            readingTimeMinutes: 18,
            practice: {
              question: "Every funnel stage requires:",
              options: { a: "Motivation only", b: "Observable proof", c: "More ads" },
              correctAnswer: "b",
              explanation: "Operational funnels are proof chains, not hope chains.",
              difficulty: 3,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Leadership Under Load",
    description: "Decision quality when execution pressure is high.",
    category: "leadership",
    difficultyLevel: "advanced",
    estimatedDurationHours: 10,
    chapters: [
      {
        title: "Priority as Sacrifice",
        description: "Saying no is a leadership execution skill.",
        objectives: ["Cut low-value work", "Protect critical path"],
        lessons: [
          {
            title: "Sacrifice Explicitly",
            contentType: "interactive",
            contentBody:
              "Leaders fail by implicit yes. List three items you will not do this week and communicate them.",
            keyConcepts: ["priority", "sacrifice", "critical-path"],
            readingTimeMinutes: 15,
            practice: {
              question: "Priority is best defined as:",
              options: { a: "Doing everything", b: "Explicit sacrifice", c: "Waiting for urgency" },
              correctAnswer: "b",
              explanation: "Priority without sacrifice is wishful multitasking.",
              difficulty: 4,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Intro to TypeScript for Builders",
    description: "Types, modules, and safe refactors for shipping code.",
    category: "coding",
    difficultyLevel: "beginner",
    estimatedDurationHours: 20,
    chapters: [
      {
        title: "Types as Contracts",
        description: "Use types to document behavior the compiler enforces.",
        objectives: ["Declare interfaces", "Narrow unions"],
        lessons: [
          {
            title: "Interfaces vs Types",
            contentType: "text",
            contentBody:
              "Interfaces describe object shapes; union types model state machines. Prefer interfaces for public APIs.",
            keyConcepts: ["typescript", "interfaces", "unions"],
            readingTimeMinutes: 20,
            practice: {
              question: "Interfaces are best for:",
              options: { a: "Public object shapes", b: "Random strings", c: "Deleting code" },
              correctAnswer: "a",
              explanation: "Interfaces document and enforce object contracts.",
              difficulty: 2,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Design Systems for Speed",
    description: "Reusable components and tokens for consistent UI.",
    category: "design",
    difficultyLevel: "intermediate",
    estimatedDurationHours: 14,
    chapters: [
      {
        title: "Tokens First",
        description: "Color, spacing, and type tokens before components.",
        objectives: ["Define tokens", "Bind components to tokens"],
        lessons: [
          {
            title: "Token Layers",
            contentType: "text",
            contentBody:
              "Primitives → semantic → component tokens. Never hardcode hex in components.",
            keyConcepts: ["tokens", "components", "consistency"],
            readingTimeMinutes: 16,
            practice: {
              question: "Components should consume:",
              options: { a: "Hardcoded hex", b: "Semantic tokens", c: "Random CSS" },
              correctAnswer: "b",
              explanation: "Tokens enable theme and consistency at scale.",
              difficulty: 3,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Strength Training for Busy Operators",
    description: "Minimum effective dose programming for consistency.",
    category: "fitness",
    difficultyLevel: "beginner",
    estimatedDurationHours: 6,
    chapters: [
      {
        title: "Minimum Effective Dose",
        description: "Consistency beats heroic sessions.",
        objectives: ["Schedule 3 sessions", "Track proof (reps/load)"],
        lessons: [
          {
            title: "Proof Over Heroics",
            contentType: "text",
            contentBody:
              "Three 30-minute sessions with logged proof outperform sporadic 90-minute marathons.",
            keyConcepts: ["consistency", "proof", "recovery"],
            readingTimeMinutes: 10,
            practice: {
              question: "Best fitness execution habit:",
              options: { a: "Random heroics", b: "Logged consistent sessions", c: "No tracking" },
              correctAnswer: "b",
              explanation: "Proof-backed consistency compounds.",
              difficulty: 1,
            },
          },
        ],
      },
    ],
  },
];
