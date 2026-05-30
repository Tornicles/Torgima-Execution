/**
 * Deterministic grammar/spelling polish for Erector goal & purpose refinement.
 * Preserves user intent; never returns raw messy text unchanged.
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
  app: "app",
  rain: "rain",
};

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

type GoalIntent = {
  verb: "Build" | "Create" | "Launch";
  object: string;
  audience: string;
  outcome: string;
};

function parseGoalIntent(normalized: string): GoalIntent {
  const lower = normalized.toLowerCase();
  let verb: GoalIntent["verb"] = "Build";
  if (/\b(create|make|design)\b/i.test(normalized)) verb = "Create";
  if (/\b(launch|start|open)\b/i.test(normalized)) verb = "Launch";

  const audience = /people|users|customers|founders|creators/i.test(normalized)
    ? "people"
    : "users";

  let object = normalized
    .replace(/^i\s+want\s+to\s+/i, "")
    .replace(/^i\s+want\s+/i, "")
    .replace(/^(build|create|launch|make|design)\s+(an?\s+)?/i, "")
    .trim();

  if (/weather|rain|forecast|alert/i.test(lower)) {
    object = "a weather app";
    const outcome = /rain|wet|storm/i.test(lower)
      ? "know when rain is coming in their area"
      : "get clearer weather alerts before conditions change";
    return { verb, object, audience, outcome };
  }
  if (/app|platform|software|saas/i.test(lower) && !/^a(n)?\s/i.test(object)) {
    object = object.match(/\bapp\b/i) ? "an app" : `a ${object.split(/\s+/).slice(0, 4).join(" ")}`;
  }

  const outcome =
    object.length > 10
      ? object.replace(/^a(n)?\s+/i, "").trim()
      : "achieve the outcome they care about";

  return { verb, object: object || "a focused product", audience, outcome };
}

/** Three polished goal options — grammar-corrected, intent preserved. */
export function polishGoalOptions(rawGoal: string): string[] {
  const normalized = normalizeMessyText(rawGoal);
  const { verb, object, audience, outcome } = parseGoalIntent(normalized);
  const core = object.replace(/^a(n)?\s+/i, "").trim() || outcome;

  const o1 = ensurePeriod(
    capitalizeSentence(
      `${verb} ${object.startsWith("a ") || object.startsWith("an ") ? object : `a ${core}`} that helps ${audience} ${outcome.includes("know") || outcome.includes("alert") ? outcome : `achieve ${outcome}`}.`,
    ),
  );
  const o2 = ensurePeriod(
    capitalizeSentence(
      `${verb === "Build" ? "Create" : "Build"} ${object.startsWith("a ") || object.startsWith("an ") ? object : `a ${core}`} that gives ${audience} a clearer, more reliable way to ${outcome.replace(/^know /i, "understand ")}.`,
    ),
  );
  const o3 = ensurePeriod(
    capitalizeSentence(
      `Launch ${object.startsWith("a ") || object.startsWith("an ") ? object : `a simple ${core}`} that provides practical value for everyday ${audience}.`,
    ),
  );

  const rawTrim = rawGoal.trim().toLowerCase();
  const unique = [o1, o2, o3].filter((o, i, arr) => {
    const key = o.toLowerCase();
    return key !== rawTrim && key.length > 15 && arr.findIndex((x) => x.toLowerCase() === key) === i;
  });
  return unique.length >= 3 ? unique.slice(0, 3) : [o1, o2, o3];
}

type PurposeIntent = {
  problem: string;
  benefit: string;
};

function parsePurposeIntent(normalized: string, selectedGoal: string): PurposeIntent {
  const lower = normalized.toLowerCase();
  const problem = /inaccurat|not accurat|bad|wrong|wet|plan bad|unreliable/i.test(lower)
    ? "existing solutions are not accurate or reliable enough"
    : /lack|hard|difficult|struggle/i.test(lower)
      ? "people struggle to get consistent results"
      : "users face unnecessary friction";

  const benefit = /weather|rain|alert/i.test(lower + selectedGoal.toLowerCase())
    ? "plan their day better with clearer weather information"
    : /save time|grow|progress/i.test(lower)
      ? "make measurable progress toward their goals"
      : "avoid costly mistakes and move forward with confidence";

  return { problem, benefit };
}

/** Three polished purpose options aligned with selectedGoal. */
export function polishPurposeOptions(rawPurpose: string, selectedGoal: string): string[] {
  const normalized = normalizeMessyText(rawPurpose);
  const goalSnippet = selectedGoal.trim().slice(0, 80);
  const { problem, benefit } = parsePurposeIntent(normalized, selectedGoal);

  const options = [
    ensurePeriod(
      capitalizeSentence(
        `Help people ${benefit} by addressing the fact that ${problem}.`,
      ),
    ),
    ensurePeriod(
      capitalizeSentence(
        `Reduce uncertainty for users by improving how this direction — ${goalSnippet} — solves ${problem.replace(/^existing /i, "")}.`,
      ),
    ),
    ensurePeriod(
      capitalizeSentence(
        `Give people a practical way to benefit from this idea through timely, easy-to-understand support aligned with ${goalSnippet}.`,
      ),
    ),
  ];

  const rawTrim = rawPurpose.trim().toLowerCase();
  const filtered = options.filter((o) => o.toLowerCase() !== rawTrim);
  return filtered.length >= 3 ? filtered.slice(0, 3) : options.slice(0, 3);
}
