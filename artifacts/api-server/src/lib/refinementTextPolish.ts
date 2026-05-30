/**
 * Deterministic grammar/spelling polish for Erector goal & purpose refinement.
 * Preserves user intent and domain keywords; never returns raw messy text unchanged.
 */

const TYPO_MAP: Record<string, string> = {
  wnat: "want",
  wan: "want",
  bild: "build",
  buid: "build",
  buidl: "build",
  wether: "weather",
  wheather: "weather",
  peple: "people",
  poeple: "people",
  accurat: "accurate",
  becos: "because",
  becaus: "because",
};

const DOMAIN_HINTS: Array<{
  pattern: RegExp;
  term: string;
  object: string;
  outcomes: [string, string, string];
}> = [
  {
    pattern: /fitness|workout|gym|stay fit/i,
    term: "fitness",
    object: "a fitness app",
    outcomes: [
      "achieve their fitness goals",
      "build healthier workout habits",
      "track progress and stay consistent",
    ],
  },
  {
    pattern: /weather|rain|forecast|alert/i,
    term: "weather",
    object: "a weather app",
    outcomes: [
      "know when rain is coming in their area",
      "receive clearer weather alerts before conditions change",
      "plan around weather with more reliable updates",
    ],
  },
  {
    pattern: /education|course|learn|student/i,
    term: "education",
    object: "an education platform",
    outcomes: [
      "learn skills more effectively",
      "access structured learning paths",
      "make measurable learning progress",
    ],
  },
  {
    pattern: /saas|software|platform/i,
    term: "SaaS",
    object: "a SaaS product",
    outcomes: [
      "solve a recurring workflow problem",
      "automate a painful manual process",
      "scale operations with less friction",
    ],
  },
  {
    pattern: /content|youtube|podcast|creator/i,
    term: "content",
    object: "a content business",
    outcomes: [
      "grow an audience with consistent publishing",
      "monetize content with a clear offer",
      "ship content faster without sacrificing quality",
    ],
  },
  {
    pattern: /agency|consulting|service business/i,
    term: "agency",
    object: "a service agency",
    outcomes: [
      "win clients with a differentiated offer",
      "deliver client outcomes reliably",
      "scale delivery without losing quality",
    ],
  },
  {
    pattern: /health|wellness|nutrition/i,
    term: "health",
    object: "a health and wellness product",
    outcomes: [
      "improve daily health habits",
      "get clearer guidance on wellness goals",
      "stay accountable to health outcomes",
    ],
  },
  {
    pattern: /ecommerce|e-commerce|online store|shop/i,
    term: "ecommerce",
    object: "an ecommerce business",
    outcomes: [
      "find and buy products more easily",
      "increase conversion with a smoother checkout",
      "grow repeat purchases with better discovery",
    ],
  },
  {
    pattern: /community|membership|forum/i,
    term: "community",
    object: "a community platform",
    outcomes: [
      "connect with people who share their interests",
      "participate in meaningful discussions",
      "build belonging around a shared goal",
    ],
  },
];

function fixToken(word: string): string {
  const lower = word.toLowerCase().replace(/[^a-z0-9']/gi, "");
  const fixed = TYPO_MAP[lower] ?? lower;
  if (!word) return word;
  const lead = word.match(/^[^a-zA-Z0-9]*/)?.[0] ?? "";
  const trail = word.match(/[^a-zA-Z0-9]*$/)?.[0] ?? "";
  if (word[0] === word[0]?.toUpperCase()) {
    return lead + fixed.charAt(0).toUpperCase() + fixed.slice(1) + trail;
  }
  return lead + fixed + trail;
}

/** Normalize messy user text: fix common typos and spacing. */
export function normalizeMessyText(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(/\b/)
    .map((part) => (/^[a-zA-Z]+$/i.test(part) ? fixToken(part) : part))
    .join("")
    .replace(/\bi\b/g, "I")
    .replace(/\s+,/g, ",")
    .replace(/\.{2,}/g, ".");
}

function capitalizeSentence(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/([.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
}

function ensurePeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (/[.!?]$/.test(t)) return t;
  return `${t}.`;
}

function detectDomainHint(normalized: string) {
  return DOMAIN_HINTS.find((d) => d.pattern.test(normalized)) ?? null;
}

/** Pull domain keywords from raw text for inclusion in polished goals. */
export function extractDomainTerms(raw: string): string[] {
  const normalized = normalizeMessyText(raw).toLowerCase();
  const terms = new Set<string>();
  for (const hint of DOMAIN_HINTS) {
    if (hint.pattern.test(normalized)) terms.add(hint.term);
  }
  const tokens = normalized.match(
    /\b(fitness|weather|education|saas|content|agency|health|ecommerce|community|coaching|marketplace)\b/gi,
  );
  for (const t of tokens ?? []) {
    terms.add(t.toLowerCase() === "saas" ? "SaaS" : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  }
  return [...terms];
}

type GoalIntent = {
  verb: "Build" | "Create" | "Launch";
  object: string;
  audience: string;
  outcomes: [string, string, string];
  domainTerms: string[];
};

function parseGoalIntent(normalized: string): GoalIntent {
  const lower = normalized.toLowerCase();
  let verb: GoalIntent["verb"] = "Build";
  if (/\b(create|make|design)\b/i.test(normalized)) verb = "Create";
  if (/\b(launch|start|open)\b/i.test(normalized)) verb = "Launch";

  const audience = /people|users|customers|founders|creators|african/i.test(normalized)
    ? "people"
    : "users";

  const domainHint = detectDomainHint(normalized);
  const domainTerms = extractDomainTerms(normalized);

  if (domainHint) {
    return {
      verb,
      object: domainHint.object,
      audience,
      outcomes: domainHint.outcomes,
      domainTerms: domainTerms.length ? domainTerms : [domainHint.term],
    };
  }

  let object = normalized
    .replace(/^i\s+want\s+to\s+/i, "")
    .replace(/^i\s+want\s+/i, "")
    .replace(/^(build|create|launch|make|design)\s+(an?\s+)?/i, "")
    .trim();

  if (/app|platform|software/i.test(lower) && object.length < 8) {
    object = "a digital product";
  } else if (object && !/^a(n)?\s/i.test(object)) {
    object = `a ${object.split(/\s+/).slice(0, 6).join(" ")}`;
  } else if (!object) {
    object = "a focused product";
  }

  const fallbackOutcome = object.replace(/^a(n)?\s+/i, "").trim() || "their primary goal";
  const base = `deliver value through ${fallbackOutcome}`;
  return {
    verb,
    object,
    audience,
    outcomes: [base, `solve a real problem with ${fallbackOutcome}`, `make progress toward ${fallbackOutcome}`],
    domainTerms,
  };
}

function withArticle(phrase: string): string {
  const t = phrase.trim();
  if (/^(a|an)\s/i.test(t)) return t;
  return /^[aeiou]/i.test(t) ? `an ${t}` : `a ${t}`;
}

function goalLine(verb: string, object: string, audience: string, outcome: string): string {
  const obj = withArticle(object.replace(/^a(n)?\s+/i, "").trim() || object);
  const cleanOutcome = outcome.replace(/^achieve\s+achieve\s+/i, "achieve ").trim();
  const tail = /^(achieve|know|receive|build|help|solve|deliver|make|grow|win|scale|improve|plan|connect|participate|find|increase|track|learn|access|automate|stay|reduce|give|ship|monetize)\b/i.test(
    cleanOutcome,
  )
    ? cleanOutcome
    : `achieve ${cleanOutcome}`;
  return ensurePeriod(capitalizeSentence(`${verb} ${obj} that helps ${audience} ${tail}.`));
}

/** Three polished goal options — grammar-corrected, intent and domain preserved. */
export function polishGoalOptions(rawGoal: string): string[] {
  const normalized = normalizeMessyText(rawGoal);
  const { verb, object, audience, outcomes } = parseGoalIntent(normalized);

  const verbs: GoalIntent["verb"][] =
    verb === "Build" ? ["Build", "Create", "Launch"] : verb === "Create" ? ["Create", "Build", "Launch"] : ["Launch", "Build", "Create"];

  const options = [
    goalLine(verbs[0], object, audience, outcomes[0]),
    goalLine(verbs[1], object, audience, outcomes[1]),
    goalLine(verbs[2], object, audience, outcomes[2]),
  ];

  const rawTrim = rawGoal.trim().toLowerCase();
  const unique = options.filter((o, i, arr) => {
    const key = o.toLowerCase();
    if (key === rawTrim || /\bachieve achieve\b/i.test(o)) return false;
    return key.length > 15 && arr.findIndex((x) => x.toLowerCase() === key) === i;
  });

  return unique.length >= 3 ? unique.slice(0, 3) : options;
}

type PurposeIntent = {
  problem: string;
  benefit: string;
};

function parsePurposeIntent(normalized: string, selectedGoal: string): PurposeIntent {
  const lower = normalized.toLowerCase();
  const goalLower = selectedGoal.toLowerCase();

  if (/fit|health|workout|gym/i.test(lower + goalLower)) {
    return {
      problem: "many people struggle to stay consistent with fitness and health habits",
      benefit: "stay fit and build healthier routines",
    };
  }
  if (/inaccurat|not accurat|bad|wrong|wet|plan bad|unreliable/i.test(lower)) {
    return {
      problem: "existing solutions are not accurate or reliable enough",
      benefit: "plan their day better with clearer and more dependable information",
    };
  }
  if (/african|diaspora/i.test(lower)) {
    return {
      problem: "many people lack practical support tailored to their context",
      benefit: "access guidance that fits their goals and environment",
    };
  }
  if (/lack|hard|difficult|struggle/i.test(lower)) {
    return {
      problem: "people struggle to get consistent results",
      benefit: "make measurable progress toward outcomes they care about",
    };
  }
  return {
    problem: "users face unnecessary friction reaching the outcome they want",
    benefit: "move forward with more clarity and confidence",
  };
}

/** Three polished purpose options aligned with selectedGoal. */
export function polishPurposeOptions(rawPurpose: string, selectedGoal: string): string[] {
  const normalized = normalizeMessyText(rawPurpose);
  const goalSnippet = selectedGoal.trim().slice(0, 80);
  const { problem, benefit } = parsePurposeIntent(normalized, selectedGoal);

  const options = [
    ensurePeriod(
      capitalizeSentence(`The purpose is to help people ${benefit} because ${problem}.`),
    ),
    ensurePeriod(
      capitalizeSentence(
        `The purpose is to reduce uncertainty for users by improving how this direction — ${goalSnippet} — addresses ${problem.replace(/^many people /i, "")}.`,
      ),
    ),
    ensurePeriod(
      capitalizeSentence(
        `The purpose is to give people a practical way to benefit from this idea through timely, easy-to-understand support aligned with ${goalSnippet}.`,
      ),
    ),
  ];

  const rawTrim = rawPurpose.trim().toLowerCase();
  const filtered = options.filter((o) => o.toLowerCase() !== rawTrim);
  return filtered.length >= 3 ? filtered.slice(0, 3) : options.slice(0, 3);
}
