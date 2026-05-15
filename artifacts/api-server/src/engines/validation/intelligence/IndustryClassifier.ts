import { DomainResolutionEngine } from "../../domain/DomainResolutionEngine.js";
import type { DomainType, IndustryClassification } from "./validation-intelligence-types.js";
import {
  getCachedIndustryClassification,
  setCachedIndustryClassification,
} from "./ValidationCache.js";

const domainEngine = new DomainResolutionEngine();

const INDUSTRY_PATTERNS: Array<{ re: RegExp; industry: string; niche: string; category: string }> = [
  { re: /\b(saas|software|app|platform|startup)\b/i, industry: "Software & SaaS", niche: "B2B SaaS", category: "technology" },
  { re: /\b(ecommerce|shopify|store|product|dropship)\b/i, industry: "E-Commerce", niche: "Direct-to-consumer", category: "commerce" },
  { re: /\b(content|youtube|creator|newsletter|audience)\b/i, industry: "Creator Economy", niche: "Audience-led business", category: "media" },
  { re: /\b(agency|consulting|freelance|client)\b/i, industry: "Professional Services", niche: "Client services", category: "services" },
  { re: /\b(fitness|health|wellness|weight)\b/i, industry: "Health & Wellness", niche: "Personal health", category: "health" },
  { re: /\b(finance|invest|revenue|mrr|money)\b/i, industry: "Finance & Revenue", niche: "Income growth", category: "finance" },
  { re: /\b(course|education|teach|learn)\b/i, industry: "Education", niche: "Knowledge products", category: "education" },
  { re: /\b(real estate|property)\b/i, industry: "Real Estate", niche: "Property ventures", category: "property" },
];

export function classifyIndustry(input: {
  goal: string;
  purpose?: string;
  domainHint?: string | null;
}): IndustryClassification {
  const cached = getCachedIndustryClassification(input.goal, input.purpose, input.domainHint);
  if (cached) return cached;

  const resolved = domainEngine.resolve(input.goal, input.domainHint ?? null) as DomainType;
  const text = `${input.goal} ${input.purpose ?? ""}`.toLowerCase();
  const keywords = [...new Set(text.split(/\W+/).filter((w) => w.length > 4))].slice(0, 12);

  for (const p of INDUSTRY_PATTERNS) {
    if (p.re.test(text)) {
      const result = { industry: p.industry, niche: p.niche, category: p.category, domain: resolved, keywords };
      setCachedIndustryClassification(input.goal, input.purpose, input.domainHint, result);
      return result;
    }
  }

  const hint = (input.domainHint ?? "").replace(/_/g, " ");
  const result = {
    industry: hint ? `${hint.charAt(0).toUpperCase()}${hint.slice(1)} Ventures` : "General Execution",
    niche: "Goal-driven execution",
    category: "general",
    domain: resolved,
    keywords,
  };
  setCachedIndustryClassification(input.goal, input.purpose, input.domainHint, result);
  return result;
}
