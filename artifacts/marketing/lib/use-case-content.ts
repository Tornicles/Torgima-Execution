export type UseCaseContent = {
  slug: string;
  emoji: string;
  title: string;
  headline: string;
  subtitle: string;
  problems: string[];
  solutions: string[];
  features: string[];
  journey: { week: string; text: string }[];
  testimonial?: { quote: string; name: string; role: string };
  seo: { title: string; description: string; keywords: string[] };
};

export const USE_CASES: Record<string, UseCaseContent> = {
  creators: {
    slug: "creators",
    emoji: "🎨",
    title: "Creators",
    headline: "Built for creators who are serious about the business, not just the content.",
    subtitle: "Most creators have large audiences and little income. Torgima gives you the execution system to change that.",
    problems: [
      "Spend 80% of time creating, almost none building the business",
      "No system for monetization, partnerships, or growth",
      "Wake up unsure if today's work actually matters",
      "Treat the career like a hobby, not a system",
    ],
    solutions: [
      "Validate your creator business model before investing months",
      "Know if your niche, audience, and monetization idea is viable",
      "Get daily tasks that build revenue — not just follower count",
      "Track whether execution is actually building income",
    ],
    features: [
      "Content production tasks (what to create, why, for whom)",
      "Audience growth tasks (specific platforms, specific actions)",
      "Monetization tasks (partnerships, products, services)",
      "Business management tasks (systems, tools, workflows)",
    ],
    journey: [
      { week: "Week 1", text: "Validate niche and monetization model" },
      { week: "Weeks 2-4", text: "Build core content system" },
      { week: "Month 2", text: "First monetization actions" },
      { week: "Month 3", text: "Revenue infrastructure" },
      { week: "Month 6", text: "Scaling and optimization" },
    ],
    testimonial: {
      quote: "I used to wake up overwhelmed by Notion. Now I see 8 tasks and know exactly what builds my creator business.",
      name: "Priya K.",
      role: "Creator & Coach",
    },
    seo: {
      title: "Torgima for Content Creators — Daily Task Manager & Business Execution System",
      description:
        "Torgima helps content creators build real businesses with 8 daily tasks aligned to creator goals, execution momentum tracking, and idea validation.",
      keywords: ["content creator tools", "creator business system", "creator productivity app"],
    },
  },
  solopreneurs: {
    slug: "solopreneurs",
    emoji: "💼",
    title: "Solopreneurs",
    headline: "One person. One system. Zero confusion about today's work.",
    subtitle: "Torgima is the execution system for solopreneurs who need to build without a team.",
    problems: [
      "Wearing every hat with no clear daily priority",
      "Project tools built for teams, not solo operators",
      "Plans that collapse by Tuesday",
      "No accountability except willpower",
    ],
    solutions: [
      "Validate your offer before months of solo grind",
      "Automatic project structure — no empty templates",
      "8 daily tasks sized to your actual capacity",
      "Signals that adapt when you have a bad week",
    ],
    features: [
      "Offer validation and positioning",
      "Client acquisition and delivery tasks",
      "Operations and systems building",
      "Revenue and pipeline milestones",
    ],
    journey: [
      { week: "Week 1", text: "Validate offer and ideal client" },
      { week: "Month 1", text: "Build acquisition rhythm" },
      { week: "Month 2", text: "Delivery systems" },
      { week: "Month 3+", text: "Scale without chaos" },
    ],
    seo: {
      title: "Torgima for Solopreneurs — Project Management & Daily Execution System",
      description:
        "Validate your idea, get a complete project plan, and execute 8 daily tasks that build your business — without a team.",
      keywords: ["solopreneur tools", "solo business management", "freelancer task manager"],
    },
  },
  agencies: {
    slug: "agencies",
    emoji: "🏢",
    title: "Agency Owners",
    headline: "Grow your agency without chaos or dropped balls.",
    subtitle: "Run your agency with an execution system that validates service ideas and keeps daily work on track.",
    problems: [
      "Client work crowds out business development",
      "No consistent system for agency growth",
      "Reactive days instead of strategic execution",
      "Team tools that don't fit owner-level goals",
    ],
    solutions: [
      "Validate new service lines before launching",
      "Daily tasks for pipeline, delivery, and ops",
      "Execution signals show when you're slipping",
      "Structure from offer to daily action",
    ],
    features: [
      "New service validation",
      "Pipeline and proposal tasks",
      "Delivery quality milestones",
      "Hiring and systems tasks",
    ],
    journey: [
      { week: "Week 1", text: "Validate positioning" },
      { week: "Month 1", text: "Pipeline system" },
      { week: "Month 2", text: "Delivery excellence" },
      { week: "Month 3+", text: "Scale team and offers" },
    ],
    seo: {
      title: "Torgima for Agency Owners — Workflow Management & Execution System",
      description:
        "Validate service ideas, build project structures, and ensure daily execution stays on track for agency owners.",
      keywords: ["agency management tool", "agency workflow software"],
    },
  },
  coaches: {
    slug: "coaches",
    emoji: "🎓",
    title: "Coaches & Consultants",
    headline: "Build your practice with validated models and daily action.",
    subtitle: "Coaches use Torgima to validate their model, grow their client base, and execute consistently.",
    problems: [
      "Great at coaching others, inconsistent on own business",
      "Generic marketing without validated positioning",
      "No daily system beyond inspiration",
      "Programs that stall after launch",
    ],
    solutions: [
      "Validate coaching niche and offer",
      "Daily tasks for content, outreach, and delivery",
      "Track execution like you ask clients to",
      "Adapt when practice growth slows",
    ],
    features: [
      "Niche and offer validation",
      "Lead generation tasks",
      "Program build and launch tasks",
      "Client success systems",
    ],
    journey: [
      { week: "Week 1", text: "Validate niche" },
      { week: "Month 1", text: "Build authority rhythm" },
      { week: "Month 2", text: "Launch offer" },
      { week: "Month 3+", text: "Fill practice" },
    ],
    testimonial: {
      quote: "I recommend Torgima to clients. It's the only tool that enforces execution instead of organizing it.",
      name: "David M.",
      role: "Business Coach",
    },
    seo: {
      title: "Torgima for Coaches & Consultants — Goal Execution & Business Management",
      description:
        "Validate your coaching model, build your practice, and execute daily tasks that grow your client base and income.",
      keywords: ["coaching business tools", "consultant project management"],
    },
  },
  startups: {
    slug: "startups",
    emoji: "🚀",
    title: "Startups & Founders",
    headline: "Validate before you build. Execute until you ship.",
    subtitle: "For founders who need honest idea validation and relentless daily execution.",
    problems: [
      "Building before validating market fit",
      "Founder to-do lists with no strategic sequence",
      "Momentum lost after first setback",
      "No system connecting MVP work to milestones",
    ],
    solutions: [
      "12-stage idea validation with real competitors",
      "Automatic project hierarchy from launch",
      "8 daily founder tasks — specific, not generic",
      "Signals that force honest progress tracking",
    ],
    features: [
      "Market and competitor intelligence",
      "MVP and validation sprint tasks",
      "Growth and traction milestones",
      "Fundraising readiness structure",
    ],
    journey: [
      { week: "Week 1", text: "Validate idea and path" },
      { week: "Month 1", text: "Build MVP" },
      { week: "Month 2", text: "First users" },
      { week: "Month 3+", text: "Iterate and scale" },
    ],
    seo: {
      title: "Torgima for Startups & Founders — Idea Validation & Execution Platform",
      description:
        "Validate your startup idea before building. Get a complete execution plan and daily tasks that adapt to your progress.",
      keywords: ["startup tools", "idea validation tool", "founder productivity"],
    },
  },
};
