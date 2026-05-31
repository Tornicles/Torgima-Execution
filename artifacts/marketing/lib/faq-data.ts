export type FaqItem = { q: string; a: string };
export type FaqCategory = { title: string; items: FaqItem[] };

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: "Getting Started",
    items: [
      {
        q: "What exactly is Torgima?",
        a: "Torgima is an intelligent execution operating system. It validates your business idea, builds your complete project structure, generates specific daily tasks, tracks your performance through signals, and adapts what you work on based on how you actually execute — not how you wish you executed.",
      },
      {
        q: "How is Torgima different from a to-do list or project manager?",
        a: "To-do lists and project managers organize information. Torgima drives behavior. It tells you which tasks to do today, why they matter, generates them from your goal and performance history, and changes difficulty and volume based on your execution state. You cannot fake progress because signals are calculated from real feedback.",
      },
      {
        q: "How long does it take to set up?",
        a: "Under five minutes. Two minutes to validate your idea, thirty seconds to name and launch your project, and your first 8 tasks are ready immediately.",
      },
      {
        q: "Do I need any experience to use Torgima?",
        a: "No. If you can describe a goal in a sentence and explain why it matters, Torgima handles the structure, task generation, and adaptation.",
      },
      {
        q: "What kind of projects work best with Torgima?",
        a: "Any goal that requires sustained daily execution: launching a business, growing a creator brand, building a SaaS product, scaling an agency, or growing a coaching practice.",
      },
    ],
  },
  {
    title: "Idea Validation",
    items: [
      {
        q: "What does the Idea Validator actually do?",
        a: "It runs your goal through 12 validation stages using real market intelligence: competitor identification, opportunity mapping, economic context for your country, execution readiness scoring, and a final verdict with three optimized paths.",
      },
      {
        q: "How accurate is the Idea Strength Score?",
        a: "The score reflects market reality, competitive density, timing, and execution readiness — not optimism. Many users score 40-60% on first validation, which is valuable because it shows what to fix before building.",
      },
      {
        q: "Are the competitor names real companies?",
        a: "Yes. The Idea Validator returns actual companies operating in your space, with profiles including strengths, weaknesses, and positioning gaps — not generic placeholder examples.",
      },
      {
        q: 'What does "Go For It" vs "Adjust Then Go" mean?',
        a: "Go For It means your idea is viable as stated — launch with the recommended path. Adjust Then Go means the core idea is sound but needs specific changes (positioning, audience, offer) before full execution. Consider a Different Angle means fundamental repositioning is needed.",
      },
      {
        q: "Can I validate multiple ideas?",
        a: "Yes. Growth and Ultimate plans include unlimited validations. Starter includes three per month.",
      },
    ],
  },
  {
    title: "Daily Tasks",
    items: [
      {
        q: "How are my 8 daily tasks generated?",
        a: "Bhudhi generates tasks from your project hierarchy, current stage, execution state, recent feedback, and performance signals. Each task includes specific instructions, definition of done, and why it matters now.",
      },
      {
        q: "Can I customize my tasks?",
        a: "You execute the tasks Torgima assigns because they are calibrated to your goal and performance. You can provide feedback that shapes tomorrow's tasks. Manual task editing is not the model — adaptation through execution is.",
      },
      {
        q: "What if I can't complete all 8 tasks?",
        a: "Complete what you can and submit honest feedback. Your signal reflects actual completion. The system may reduce tomorrow's count if performance drops consistently.",
      },
      {
        q: "What happens if I miss a day?",
        a: "Your momentum streak resets. Your execution state may shift toward recovery mode with fewer, easier tasks. The system does not punish you — it adapts to help you rebuild.",
      },
      {
        q: "Are the tasks always the same or do they change?",
        a: "They change daily based on your progress, feedback, and execution state. No two weeks look the same unless your performance and position are identical.",
      },
    ],
  },
  {
    title: "Feedback & Signals",
    items: [
      {
        q: "Why does Torgima require feedback after every task?",
        a: "Feedback is the fuel for adaptation. Without it, the system cannot know if tasks were too hard, blocked, or irrelevant. Your next tasks are only as good as your honesty about what happened.",
      },
      {
        q: "What happens if my feedback is too short?",
        a: "Bhudhi may ask a quick clarification question before generating your next task. This ensures the system has enough signal to adapt correctly.",
      },
      {
        q: "How is my Execution Score calculated?",
        a: "From completion rate, execution quality (from your ratings and reflection depth), momentum streak, and direction trend over a rolling window. Internal weights prioritize recent honest feedback.",
      },
      {
        q: "Can I fake my signal score?",
        a: "The system detects inconsistent patterns — high scores with blocked outcomes, shallow reflections, or gaming behaviors. Signals reflect sustained execution over time, not single-day spikes.",
      },
      {
        q: 'What is a "Day Streak"?',
        a: "Consecutive days you completed at least one task and submitted feedback. Streaks influence momentum in your signal profile and unlock consistency-based task difficulty.",
      },
    ],
  },
  {
    title: "Execution States",
    items: [
      {
        q: "What are the 7 execution states?",
        a: "Getting Started, Needs Attention, Rebuild Momentum, Steady Progress, Strong Execution, Peak Performance, and Shifting Gears. Each controls task count, difficulty caps, and allowed project actions.",
      },
      {
        q: 'How do I get from "Getting Started" to "Peak Performance"?',
        a: "Execute consistently, submit honest feedback, maintain your streak, and complete tasks at the difficulty you're assigned. The system promotes you when signals sustain above thresholds — typically weeks of consistent execution.",
      },
      {
        q: 'What happens in "Needs Attention" state?',
        a: "Task count drops. Difficulty caps at easy. Recovery-focused tasks are generated. The goal is rebuilding execution habit, not pushing harder.",
      },
      {
        q: "Can I manually change my state?",
        a: "No. States are calculated from signals to prevent self-deception. You change state by changing execution behavior.",
      },
      {
        q: "How long does each state last?",
        a: "As long as your performance warrants it. Some users stay in Steady Progress for months. Others move to Strong Execution in 3-4 weeks of consistent daily work.",
      },
    ],
  },
  {
    title: "Pricing & Account",
    items: [
      {
        q: "Is there a free plan?",
        a: "Yes. Validate your idea free. Starter tier at $9/month includes limited daily tasks and basic signals for your first active project.",
      },
      {
        q: "Can I change plans later?",
        a: "Yes, upgrade or downgrade anytime from account settings. Changes apply on your next billing cycle.",
      },
      {
        q: "Do you offer refunds?",
        a: "If Torgima does not deliver value in your first 14 days, contact support for a full refund. We want builders who execute, not subscribers who forget.",
      },
      {
        q: "Is my data secure?",
        a: "Yes. Data is encrypted in transit and at rest. We do not sell your project data. See our Privacy Policy for full details.",
      },
      {
        q: "Do you have a mobile app?",
        a: "The web app is fully mobile-responsive. Native iOS and Android apps are on the roadmap.",
      },
    ],
  },
];
