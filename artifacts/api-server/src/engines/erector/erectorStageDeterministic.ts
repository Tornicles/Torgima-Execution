/**
 * Deterministic fallbacks for 20 Erector validation stages (doc §F).
 */
import type { ValidationFeedInput } from "../../types/erector-complete.js";

const searchDate = () =>
  new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export function searchPreamble(input: ValidationFeedInput): string {
  return `Today: ${searchDate()}. Goal: ${input.goal_final}. Country: ${input.country}. Business type: ${input.business_type}. Economic type: ${input.economic_type ?? "General market"}.`;
}

export const stageDeterministicFallbacks: Record<string, (input: ValidationFeedInput) => Record<string, unknown>> = {
  stage_2_decomposition: (input) => ({
    problem_claim: `Users lack practical support to achieve: ${input.goal_final.slice(0, 120)}`,
    target_user: input.target_customer,
    change_claim: "Users build consistent progress toward the stated outcome",
    value_claim: input.purpose_final,
  }),
  stage_3_economic: (input) => ({
    economic_type: input.economic_type ?? "General market economy",
    digital_adoption: "moderate",
    competition_level: "moderate",
    trust_requirements: "Proof and social validation required before purchase",
    payment_behaviour: "Price-sensitive with preference for trial or freemium entry",
    marketing_channels: ["social", "community", "direct outreach"],
  }),
  stage_4_patterns: (input) => ({
    businesses: [
      { name: "Category leader (reference)", why_it_works: "Strong distribution and brand trust", model: "Subscription", what_to_learn: "Narrow positioning wins" },
      { name: "Regional specialist", why_it_works: "Local relevance and community", model: "Service + content", what_to_learn: "Cultural fit matters" },
      { name: "Lean indie operator", why_it_works: "Low burn and fast iteration", model: "Direct sales", what_to_learn: "Proof before scale" },
    ],
    search_context: searchPreamble(input),
  }),
  stage_5_timing: (input) => ({
    market_maturity: "Growing with increasing digital adoption",
    demand_direction: "Upward for niche solutions with clear outcomes",
    competition_pressure: "Moderate — differentiation required",
    timing_window: "12–24 months to establish wedge before commoditization",
    why_now: `Current conditions in ${input.country} favor focused ${input.business_type} offers with visible proof`,
    search_context: searchPreamble(input),
  }),
  stage_6_market: (input) => ({
    points: [
      { label: "Demand", detail: `Demand exists among ${input.target_customer} for outcomes tied to the goal` },
      { label: "Competition", detail: "Generic alternatives are crowded; focused positioning reduces direct competition" },
      { label: "Opportunity", detail: "Gap in culturally relevant execution and accountability loops" },
    ],
    search_context: searchPreamble(input),
  }),
  stage_7_channels: (input) => ({
    channels: [
      { name: "Instagram", why_it_matters: "Visual proof and community discovery for consumer offers" },
      { name: "TikTok", why_it_matters: "Short demos reach new audiences quickly" },
      { name: "Email / WhatsApp", why_it_matters: "Retention and accountability for early cohorts" },
    ],
    search_context: searchPreamble(input),
  }),
  stage_8_pros: () => ({
    pros: [
      { title: "Clear problem", explanation: "The outcome is easy to explain and measure" },
      { title: "Defined audience", explanation: "Target customer can be reached with focused channels" },
      { title: "Lean start", explanation: "Minimum version can be tested without large capital" },
      { title: "Repeatable delivery", explanation: "Success creates proof that compounds trust" },
    ],
  }),
  stage_9_cons: () => ({
    cons: [
      { title: "Retention risk", explanation: "Users may drop off after initial motivation fades" },
      { title: "Acquisition cost", explanation: "Paid channels may be expensive before proof exists" },
      { title: "Scope creep", explanation: "Building too much before validation wastes runway" },
      { title: "Trust barrier", explanation: "New offers need consistent proof before conversion" },
    ],
  }),
  stage_10_feasibility: (input) => ({
    technical: input.resources.some((r) => /cod|tech|dev/i.test(r)) ? "achievable" : "may need partners",
    time: input.commitment_level,
    budget: input.budget,
    skill: input.resources,
    resource_gaps: input.budget < 1000 ? ["Marketing budget", "Design support"] : [],
    overall: input.budget >= 500 ? "with_adjustments" : "challenging",
  }),
  stage_11_viability: (input) => ({
    revenue_possibility: `Via ${input.business_model}`,
    retention: "Depends on habit loop and accountability",
    pricing: "Start with single clear offer; add tiers after proof",
    distribution: input.business_type,
    survival: "Viable if acquisition stays lean and retention improves monthly",
    overall: "with_adjustments",
  }),
  stage_12_bootstrap: (input) => ({
    minimum_version: "One workflow that delivers the core outcome once",
    first_users: input.target_customer,
    first_offer: input.business_model,
    first_revenue_path: "Direct outreach → paid pilot",
    avoid_early: ["Full platform", "Automated scaling", "Large paid ads"],
  }),
  stage_13_features: () => ({
    build_first: ["Core workflow", "Proof capture", "Simple onboarding"],
    build_later: ["Automation", "Analytics dashboard", "Community features"],
    avoid_now: ["Enterprise features", "Multi-sided marketplace"],
  }),
  stage_14_customer: (input) => ({
    primary: input.target_customer,
    secondary: "Adjacent users with similar pain but lower urgency",
    avoid: "Everyone — broad positioning kills conversion",
    first_100_users: "Manually recruited early believers from direct outreach",
  }),
  stage_15_positioning: (input) => ({
    unique_angle: `Focused ${input.business_type} for ${input.target_customer}`,
    switching_reason: "More relevant than generic alternatives",
    message: input.goal_final,
    differentiation: input.purpose_final.slice(0, 200),
  }),
  stage_16_difficulty: () => ({
    building: { level: "medium", why: "Scope must stay minimal until proof" },
    marketing: { level: "medium", why: "Trust must be earned with consistent proof" },
    retention: { level: "high", why: "Habit formation is the primary failure mode" },
    operations: { level: "low", why: "Early stage is founder-led delivery" },
  }),
  stage_17_revenue: (input) => ({
    paths: [
      { label: "Free acquisition", description: "Content and outreach to first cohort" },
      { label: "Premium offer", description: input.business_model },
      { label: "Coaching", description: "High-touch tier for faster outcomes" },
      { label: "Subscription", description: "Recurring once habit loop is proven" },
    ],
  }),
  stage_18_90days: (input) => ({
    month_1: "Validate offer with 10–20 direct conversations and 3 paying pilots",
    month_2: "Iterate delivery based on feedback; improve retention loop",
    month_3: "Document playbook; scale outreach channels that converted",
    milestone: input.goal_final.slice(0, 120),
  }),
  stage_19_paths: (input) => ({
    foundation: {
      description: "Proof-first execution. Slowest, lowest risk.",
      who: "First-time builders, limited budget, prior failed attempts",
      requires: "5–10 hours/week, manual outreach, patience",
      risk: "Slower traction if market is impatient",
      target: "Validated offer with paying pilots in 90 days",
    },
    momentum: {
      description: "MVP-first. Balanced speed and learning.",
      who: "Some experience, moderate resources, clear idea",
      requires: "10–20 hours/week, ship weekly, measure retention",
      risk: "Moderate — may need pivot after first cohort",
      target: "Working MVP with repeatable acquisition in 60–90 days",
    },
    overdrive: {
      description: "Aggressive execution. High pressure, faster risk.",
      who: "Experienced operators with buffer or funding",
      requires: "20+ hours/week, parallel channels, fast iteration",
      risk: "Higher burn if assumptions are wrong",
      target: "Scale signal within 30–60 days",
    },
    goal: input.goal_final,
  }),
  stage_20_decision: () => ({
    decision: "adjust",
    explanation: "Proceed with focused proof plan; adjust scope to minimum viable offer before scaling.",
  }),
};
