import { useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Download, Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeaderActions } from "@/components/design-system/PageHeaderActions";
import type { PathKey } from "./PathPanels";
import type { ValidationScreenData } from "./ValidationScreen";
import { apiFetchEnvelope } from "@/lib/torgima-api";
import { postValidationRun } from "@/lib/validation-run";
import {
  bottomCtaSentence,
  buildViewModel,
  demandLevel,
  headlineForVerdict,
  plainRiskTitle,
  ringStrokeColor,
} from "./validation-results-helpers";

function ConfidenceRing({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = ringStrokeColor(pct);
  return (
    <svg width="140" height="140" viewBox="0 0 120 120" className="mx-auto">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
    </svg>
  );
}

function ExpandPanel({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: open ? "800px" : "0px", opacity: open ? 1 : 0 }}
    >
      <div className="pt-3 pb-1">{children}</div>
    </div>
  );
}

export function ValidationResultsDashboard({
  data,
  validationId,
  completedLabel = "Ready",
  selectedPath,
  onSelectPath,
  onLaunch,
  onDownload,
  launching,
  launchError,
  onDataUpdate,
}: {
  data: ValidationScreenData;
  validationId?: string;
  completedLabel?: string;
  selectedPath: PathKey;
  onSelectPath: (p: PathKey) => void;
  onLaunch: () => void;
  onDownload?: () => void;
  launching?: boolean;
  launchError?: string;
  onDataUpdate?: (next: ValidationScreenData) => void;
}) {
  const vm = useMemo(() => buildViewModel(data), [data]);
  const section8Ref = useRef<HTMLElement>(null);
  const section10Ref = useRef<HTMLElement>(null);
  const bottomRef = useRef<HTMLElement>(null);

  const [whyOpen, setWhyOpen] = useState(false);
  const [goalInterpretation, setGoalInterpretation] = useState(0);
  const [modalCompetitor, setModalCompetitor] = useState<Record<string, unknown> | null>(null);
  const [openMarketTile, setOpenMarketTile] = useState<string | null>(null);
  const [openRisk, setOpenRisk] = useState<number | null>(null);
  const [ackRisks, setAckRisks] = useState<Record<number, boolean>>({});
  const [openInvestorQ, setOpenInvestorQ] = useState<number | null>(null);
  const [highlightPath, setHighlightPath] = useState<PathKey | null>(null);
  const [pathChosen, setPathChosen] = useState<PathKey | null>(null);
  const [pathSelectLoading, setPathSelectLoading] = useState<PathKey | null>(null);
  const [pathSelectError, setPathSelectError] = useState("");
  const [rerunLoading, setRerunLoading] = useState(false);
  const [rerunError, setRerunError] = useState("");
  const [simCountry, setSimCountry] = useState(vm.locationCountry);
  const [simCommitment, setSimCommitment] = useState(vm.commitmentLevel);
  const [simBusiness, setSimBusiness] = useState(vm.businessModel);
  const [simTimeline, setSimTimeline] = useState("1yr");
  const [simBusinessType, setSimBusinessType] = useState("Online");
  const [pricingOpen, setPricingOpen] = useState(false);

  const demand = demandLevel(vm.marketScore);
  const risks = vm.industryCons.slice(0, 5);

  const interpretationOptions = useMemo(() => {
    const pd = vm.purposeDecomposition;
    if (pd) {
      return [
        String(pd.valueClaim ?? pd.value_claim ?? "You want to create meaningful value for people."),
        String(pd.changeClaim ?? pd.change_claim ?? "You want to change how something works in this space."),
        String(pd.problemClaim ?? pd.problem_claim ?? "You want to solve a specific problem people feel today."),
      ];
    }
    const g = vm.rawGoal || "your goal";
    return [
      `You want to build something that delivers on: ${g}`,
      `You want to grow an offer around: ${g}`,
      `You want to test whether this idea can work in practice: ${g}`,
    ];
  }, [vm]);

  async function handlePathChoose(path: PathKey) {
    if (!validationId) {
      onSelectPath(path);
      setPathChosen(path);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setPathSelectLoading(path);
    setPathSelectError("");
    const envelope = await apiFetchEnvelope(`/api/v1/validation/${validationId}/select-path`, {
      method: "POST",
      body: JSON.stringify({ selectedPath: path }),
    });
    setPathSelectLoading(null);
    if (!envelope.ok) {
      setPathSelectError(envelope.error?.message ?? "Could not save your choice.");
      return;
    }
    onSelectPath(path);
    setPathChosen(path);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleRerun() {
    if (!vm.blueprintId) {
      setRerunError("Blueprint id missing — cannot rerun.");
      return;
    }
    setRerunLoading(true);
    setRerunError("");
    const result = await postValidationRun({
      blueprintId: vm.blueprintId,
      idempotencyKey: crypto.randomUUID(),
      rawGoal: vm.rawGoal,
      purpose: vm.purpose || vm.rawGoal,
      timeframe: simTimeline,
      commitmentLevel: simCommitment,
      locationCountry: simCountry,
      businessModel: simBusiness,
      businessType: simBusinessType.toLowerCase(),
    });
    setRerunLoading(false);
    if (!result.ok || !result.validationId) {
      setRerunError(result.errorMessage ?? "Rerun failed.");
      return;
    }
    const envelope = await apiFetchEnvelope<Record<string, unknown>>(`/api/v1/validation/${result.validationId}`);
    if (envelope.ok && envelope.data && onDataUpdate) {
      onDataUpdate({
        ...data,
        erectorValidationId: result.validationId,
        validationId: result.validationId,
        intelligence: { ...(data.intelligence ?? {}), erector: envelope.data },
        verdict: String(envelope.data.verdict ?? data.verdict),
        paths: (envelope.data.paths as ValidationScreenData["paths"]) ?? data.paths,
      });
    }
  }

  const previews: string[] = [];
  if (simCountry !== vm.locationCountry) {
    previews.push("Competition might be different there.");
    previews.push("Demand signals vary by country.");
  }
  if (simCommitment !== vm.commitmentLevel) previews.push("Your pace affects how fast you can move.");
  if (simBusiness !== vm.businessModel) previews.push("Your business type changes what is realistic.");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-32 space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Here is what we found about your idea</h1>
          <p className="text-sm text-gray-500 mt-1">A plain-language reality check based on your goal and market.</p>
          <span className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full bg-[#f0faf3] text-[#1a8c3a] border border-green-100">
            {completedLabel}
          </span>
        </div>
        <PageHeaderActions />
      </header>

      {launchError && (
        <pre className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-4 whitespace-pre-wrap">
          {launchError}
        </pre>
      )}

      {/* Section 1 — Reality Summary */}
      <section className="rounded-lg border border-gray-200 bg-white border-l-4 border-l-[#1a8c3a] p-6 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          <p className="text-[28px] font-bold text-gray-900 leading-snug">{headlineForVerdict(vm.verdict)}</p>
          <p className="text-sm text-gray-600 mt-3">Based on your goal, your situation, and current market signals.</p>
          <button
            type="button"
            onClick={() => setWhyOpen((o) => !o)}
            className="mt-4 text-sm font-medium text-[#1a8c3a] flex items-center gap-1"
          >
            Why does it say this? {whyOpen ? "▲" : "▼"}
          </button>
          <ExpandPanel open={whyOpen}>
            <p className="text-sm text-gray-700 leading-relaxed">
              You are based in {vm.locationCountry}. You selected {vm.commitmentLevel.toLowerCase()} commitment. You are
              building a {vm.businessModel} business. These factors shaped how strong this looks today.
            </p>
          </ExpandPanel>
        </div>
        <div className="w-full lg:w-[40%] text-center shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">How strong this looks today</p>
          <ConfidenceRing pct={vm.ringPct} />
          <p className="text-xs text-gray-500 mt-2">Based on your goal, situation, and market signals</p>
        </div>
      </section>

      {/* Section 2 — Understanding Your Goal */}
      <section>
        <h2 className="text-lg font-bold text-gray-900">Let us make sure we understood you correctly</h2>
        <div className="bg-gray-50 rounded-lg p-4 mt-4 mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Your goal</p>
          <p className="text-base font-medium text-gray-900">{vm.rawGoal || "—"}</p>
          <p className="text-xs text-gray-400 uppercase tracking-wide mt-3 mb-1">Your reason</p>
          <p className="text-sm text-gray-700">{vm.purpose || "—"}</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {interpretationOptions.map((text, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setGoalInterpretation(i)}
              className={`text-left rounded-lg border p-4 text-sm transition-colors ${
                goalInterpretation === i
                  ? "border-[#1a8c3a] bg-[#f0faf3] ring-1 ring-[#1a8c3a]"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="text-xs font-bold text-gray-500 block mb-2">Option {String.fromCharCode(65 + i)}</span>
              {text}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Does one of these feel more accurate? Selecting one will not change your results — it helps us explain things
          better.
        </p>
      </section>

      {/* Section 3 — Competitors */}
      <section>
        <h2 className="text-lg font-bold text-gray-900">Who else is already doing something similar?</h2>
        <p className="text-sm text-gray-600 mt-1">Knowing who is already winning helps you find where to stand out.</p>
        {vm.competitors.length === 0 ? (
          <p className="text-sm text-gray-500 mt-4 py-6 text-center border border-dashed border-gray-200 rounded-lg">
            Competitor data is being gathered. Check back shortly.
          </p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            {vm.competitors.map((c, i) => {
              const name = String(c.name ?? "Company");
              return (
                <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center mb-3">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-bold text-[15px] text-gray-900">{name}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Why people choose them</p>
                  <p className="text-xs text-gray-600 line-clamp-3">
                    {String(c.positioningStrategy ?? c.positioning_strategy ?? "They serve a similar audience.")}
                  </p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Where you could stand out</p>
                  <p className="text-xs text-gray-600">
                    {String(c.strategicGapForUser ?? c.strategic_gap_for_user ?? "Gap analysis not available for this competitor.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setModalCompetitor(c)}
                    className="mt-3 w-full text-sm border border-gray-200 rounded-lg py-2 hover:bg-gray-50"
                  >
                    Tell me more
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={Boolean(modalCompetitor)} onOpenChange={(o) => !o && setModalCompetitor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{String(modalCompetitor?.name ?? "Competitor")}</DialogTitle>
          </DialogHeader>
          {modalCompetitor && (
            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <p className="font-semibold text-gray-900 mb-1">What they do well</p>
                <ul className="list-disc pl-5">
                  {(Array.isArray(modalCompetitor.survivorBehaviours)
                    ? modalCompetitor.survivorBehaviours
                    : Array.isArray(modalCompetitor.survivor_behaviours)
                      ? modalCompetitor.survivor_behaviours
                      : []
                  ).map((b: unknown, idx: number) => (
                    <li key={idx}>{String(b)}</li>
                  ))}
                  {!Array.isArray(modalCompetitor.survivorBehaviours) &&
                    !Array.isArray(modalCompetitor.survivor_behaviours) && (
                      <li>They have a clear offer that people already recognize.</li>
                    )}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">What users complain about</p>
                <p>
                  {String(
                    modalCompetitor.strategicGapForUser ??
                      modalCompetitor.strategic_gap_for_user ??
                      "Users often want simpler pricing and faster support.",
                  )}
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">What you can learn</p>
                <p>{String(modalCompetitor.archetypeContext ?? modalCompetitor.archetype_context ?? "Focus on a narrower promise and prove it quickly.")}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pricingOpen} onOpenChange={setPricingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pricing angles to consider</DialogTitle>
          </DialogHeader>
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-2">
            {(
              (vm.erector.economy_briefing as { pricingAngles?: string[] })?.pricingAngles ??
              (vm.erector.economyBriefing as { pricingAngles?: string[] })?.pricingAngles ??
              [
                "Start with a simple offer people can try quickly.",
                "Price for clarity — one main package beats many confusing tiers.",
                "Test a lower entry price, then raise it once people see results.",
              ]
            ).map((tip, i) => (
              <li key={i}>{String(tip)}</li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Section 4 — Market */}
      <section>
        <h2 className="text-lg font-bold text-gray-900">What the market looks like</h2>
        <p className="text-sm text-gray-600 mt-1">Understanding the space you are entering.</p>
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          {[
            {
              id: "demand",
              title: "Do people want this?",
              value:
                vm.marketScore >= 7 ? "High" : vm.marketScore >= 4 ? "Medium" : "Low",
              color:
                vm.marketScore >= 7 ? "text-[#1a8c3a]" : vm.marketScore >= 4 ? "text-orange-600" : "text-red-600",
              expand:
                vm.marketScore >= 7
                  ? `People in ${vm.locationCountry} are already paying for similar solutions. This means there is real appetite for what you want to build.`
                  : vm.marketScore >= 4
                    ? "Interest exists, but getting people to pay requires extra work in this area."
                    : "Low signals of people paying for this in your area right now.",
            },
            {
              id: "crowded",
              title: "How crowded is it?",
              value:
                vm.competitionScore >= 8
                  ? "Very crowded"
                  : vm.competitionScore >= 5
                    ? "Somewhat crowded"
                    : "Open",
              color: "text-gray-900",
              expand:
                vm.competitionScore >= 8
                  ? "A few strong players are already established. This is not a reason to stop — but it means you need a clear reason to stand out."
                  : vm.competitionScore >= 5
                    ? "The space is competitive but there is still room for a focused angle."
                    : "The space is open. Fewer competitors means more room to grow.",
            },
            {
              id: "growth",
              title: "Is it growing?",
              value: vm.timingScore >= 7 ? "Yes, growing" : vm.timingScore >= 4 ? "Slowly" : "Not right now",
              color: vm.timingScore >= 7 ? "text-[#1a8c3a]" : "text-gray-700",
              expand:
                vm.timingScore >= 7
                  ? "This type of business is growing right now. Good timing."
                  : vm.timingScore >= 4
                    ? "This space has slowed down recently. There is still opportunity for the right angle."
                    : "This space has slowed down recently. Starting earlier would have been better, but there is still opportunity for the right angle.",
            },
          ].map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => setOpenMarketTile(openMarketTile === tile.id ? null : tile.id)}
              className="text-left rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300"
            >
              <p className="text-xs text-gray-500">{tile.title}</p>
              <p className={`text-lg font-bold mt-1 ${tile.color}`}>{tile.value}</p>
              <ExpandPanel open={openMarketTile === tile.id}>
                <p className="text-sm text-gray-600">{tile.expand}</p>
              </ExpandPanel>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { label: "What if I was in a different country?", scroll: "try-versions" },
            { label: "What if I targeted a different audience?", scroll: "try-versions" },
            { label: "What if I changed my price?", scroll: "pricing" },
          ].map((pill) => (
            <button
              key={pill.label}
              type="button"
              onClick={() => {
                if (pill.scroll === "pricing") setPricingOpen(true);
                else section8Ref.current?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
            >
              {pill.label}
            </button>
          ))}
        </div>
      </section>

      {/* Section 5 — Demand */}
      <section>
        <h2 className="text-lg font-bold text-gray-900">Do people actually want this?</h2>
        <p className="text-sm text-gray-600 mt-1">The most important question. Demand tells you if there is a real problem to solve.</p>
        <p
          className={`text-xl font-bold mt-6 ${
            demand === "HIGH" ? "text-[#1a8c3a]" : demand === "MEDIUM" ? "text-orange-600" : "text-red-600"
          }`}
        >
          {demand === "HIGH" &&
            `People in ${vm.locationCountry} are already buying similar solutions.`}
          {demand === "MEDIUM" &&
            "Some interest exists, but converting that interest to paying customers takes more work."}
          {demand === "LOW" && "Low signals of people paying for this in your area right now."}
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <details className="rounded-lg border border-gray-200 bg-white p-4">
            <summary className="text-sm font-semibold cursor-pointer">What makes demand higher here?</summary>
            <ul className="mt-2 text-sm text-gray-600 list-disc pl-4 space-y-1">
              <li>People already spend money in this category.</li>
              <li>Your goal targets a problem people mention often.</li>
              <li>Similar offers are gaining traction nearby.</li>
            </ul>
          </details>
          <details className="rounded-lg border border-gray-200 bg-white p-4">
            <summary className="text-sm font-semibold cursor-pointer">What could lower demand?</summary>
            <ul className="mt-2 text-sm text-gray-600 list-disc pl-4 space-y-1">
              <li>Buyers may need more education before they pay.</li>
              <li>The problem may feel nice-to-have rather than urgent.</li>
              <li>Trust may take longer to build in this space.</li>
            </ul>
          </details>
        </div>
      </section>

      {/* Section 6 — Risks */}
      <section>
        <h2 className="text-lg font-bold text-gray-900">Things that could slow you down</h2>
        <p className="text-sm text-gray-600 mt-1">These are not reasons to stop. They are things to plan for.</p>
        {risks.length === 0 ? (
          <p className="text-sm text-gray-500 mt-4 py-4">No major blockers identified. Keep an eye on how crowded this space is.</p>
        ) : (
          <div className="space-y-3 mt-4">
            {risks.map((risk, i) => {
              const title = plainRiskTitle(risk);
              const open = openRisk === i;
              return (
                <div key={i} className="rounded-lg border border-orange-100 bg-orange-50/30 p-4">
                  <button
                    type="button"
                    onClick={() => setOpenRisk(open ? null : i)}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{title}</p>
                      <p className="text-sm text-gray-600 mt-1">{risk}</p>
                    </div>
                    {ackRisks[i] && <CheckCircle2 className="w-5 h-5 text-[#1a8c3a]" />}
                  </button>
                  <ExpandPanel open={open}>
                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Why:</span> This showed up because of your goal, timeline, and how
                      this space behaves today.
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">How to reduce it:</span> Narrow your first offer, set a weekly
                      rhythm, and prove one outcome before expanding.
                    </p>
                    <button
                      type="button"
                      onClick={() => setAckRisks((a) => ({ ...a, [i]: true }))}
                      className="mt-3 text-sm font-medium text-[#1a8c3a] border border-[#1a8c3a] rounded-lg px-3 py-1.5"
                    >
                      Apply this suggestion
                    </button>
                  </ExpandPanel>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 7 — If this was your money */}
      <section>
        <h2 className="text-lg font-bold text-gray-900">If this was your money, would you back it?</h2>
        <p className="text-sm text-gray-600 mt-1">Think of yourself as your own backer. These are the questions a smart backer would ask.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {[
            {
              q: "Would people care?",
              a:
                vm.marketScore >= 7 ? "Yes" : vm.marketScore >= 4 ? "Possibly" : "Not yet",
              why: `Demand signals in ${vm.locationCountry} suggest ${vm.marketScore >= 7 ? "real interest" : "mixed interest"} for this type of offer.`,
            },
            {
              q: "Can you stay consistent?",
              a:
                ["high", "intense"].includes(vm.commitmentLevel.toLowerCase())
                  ? "Yes, based on your commitment."
                  : vm.commitmentLevel.toLowerCase() === "medium"
                    ? "Likely, with discipline."
                    : "This may be challenging at your current pace.",
              why: "Your stated commitment level is the main input for whether you can keep showing up week after week.",
            },
            {
              q: "Can this make money?",
              a:
                vm.scalabilityScore >= 7 ? "Yes" : vm.scalabilityScore >= 4 ? "With the right model" : "Hard at this stage",
              why: "We looked at whether this can grow beyond a one-off project and still make sense economically.",
            },
            {
              q: "Would someone recommend it?",
              a:
                vm.momentumScore >= 7 ? "High" : vm.momentumScore >= 4 ? "Possible" : "Needs work",
              why: "Momentum reflects how quickly word-of-mouth and repeat use could build if you execute well.",
            },
            {
              q: "Could this grow beyond your area?",
              a:
                vm.scalabilityScore >= 6 && vm.localEconomyScore >= 6
                  ? "Yes"
                  : vm.scalabilityScore >= 4 || vm.localEconomyScore >= 4
                    ? "Maybe"
                    : "Not easily",
              why: "We combined how supportive your location is with how expandable the model looks.",
            },
          ].map((item, i) => (
            <button
              key={item.q}
              type="button"
              onClick={() => setOpenInvestorQ(openInvestorQ === i ? null : i)}
              className="text-left rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300"
            >
              <p className="text-sm font-semibold text-gray-900">{item.q}</p>
              <p className="text-[#1a8c3a] font-bold mt-1">{item.a}</p>
              <ExpandPanel open={openInvestorQ === i}>
                <p className="text-sm text-gray-600">{item.why}</p>
              </ExpandPanel>
            </button>
          ))}
        </div>
      </section>

      {/* Section 8 — Try different versions */}
      <section ref={section8Ref} className={rerunLoading ? "opacity-90" : ""}>
        <h2 className="text-lg font-bold text-gray-900">What if something was different?</h2>
        <p className="text-sm text-gray-600 mt-1">Change one thing and see how it affects your results. No commitment required.</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <label className="text-sm">
            <span className="text-gray-600 block mb-1">Country</span>
            <select
              value={simCountry}
              onChange={(e) => setSimCountry(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              {["United States", "Nigeria", "United Kingdom", "Germany", "India", "Canada"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-gray-600 block mb-1">Commitment level</span>
            <select
              value={simCommitment}
              onChange={(e) => setSimCommitment(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              {["LOW", "MEDIUM", "HIGH", "INTENSE"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-gray-600 block mb-1">What you are building</span>
            <select
              value={simBusiness}
              onChange={(e) => setSimBusiness(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              {["SaaS", "Service", "Product", "Marketplace", "Content"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-gray-600 block mb-1">Business type</span>
            <select
              value={simBusinessType}
              onChange={(e) => setSimBusinessType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              {["Online", "Offline", "Hybrid"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-gray-600 block mb-1">Timeline</span>
            <select
              value={simTimeline}
              onChange={(e) => setSimTimeline(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              {[
                { v: "3m", l: "3 months" },
                { v: "6m", l: "6 months" },
                { v: "1yr", l: "1 year" },
                { v: "2yr", l: "2 years" },
              ].map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </label>
        </div>
        {previews.length > 0 && (
          <ul className="mt-3 text-sm text-gray-600 list-disc pl-5">
            {previews.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={rerunLoading}
          onClick={() => void handleRerun()}
          className="mt-4 rounded-lg bg-[#1a8c3a] text-white font-semibold px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {rerunLoading ? "Updating…" : "Show me the full picture"}
        </button>
        {rerunError && <p className="text-sm text-red-600 mt-2">{rerunError}</p>}
      </section>

      {/* Section 9 — Another way */}
      <section className={rerunLoading ? "animate-pulse opacity-60 pointer-events-none" : ""}>
        <h2 className="text-lg font-bold text-gray-900">Another way you could approach this</h2>
        <p className="text-sm text-gray-600 mt-1">These are not better or worse — just different angles. Pick what feels right.</p>
        {!vm.paths.current.description && !vm.paths.adjusted.description ? (
          <p className="text-sm text-gray-500 mt-4">Path analysis is being generated. You can still keep going with your current direction.</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            {[
              { title: "Keep going as planned", path: vm.paths.current, key: "current" as PathKey },
              {
                title: "Start smaller, then grow",
                path: vm.paths.adjusted,
                key: "adjusted" as PathKey,
              },
              {
                title: "Try a completely different angle",
                path: vm.paths.alternative,
                key: "alternative" as PathKey,
              },
            ].map((card) => {
              const mods = card.path.coreModifications ?? card.path.core_modifications;
              const mod0 = Array.isArray(mods) ? String(mods[0]) : "";
              return (
                <div
                  key={card.key}
                  className={`rounded-lg border p-4 bg-white ${
                    highlightPath === card.key ? "border-[#1a8c3a] ring-1 ring-[#1a8c3a]" : "border-gray-200"
                  }`}
                >
                  <p className="font-bold text-gray-900">{card.title}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    {String(card.path.description ?? card.path.summary ?? mod0 || "A different way to reach the same goal.")}
                  </p>
                  <p className="text-xs text-gray-500 mt-3">
                    <span className="font-medium">What changes:</span> {mod0 || "Focus and scope adjust."}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="font-medium">What gets better:</span> Clearer path with less wasted effort.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="font-medium">What stays the same:</span> Your core goal stays intact.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setHighlightPath(card.key);
                      section10Ref.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="mt-4 text-sm font-medium text-[#1a8c3a]"
                  >
                    Try this →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 10 — Your choice */}
      <section ref={section10Ref}>
        <h2 className="text-lg font-bold text-gray-900">What do you want to do?</h2>
        <p className="text-sm text-gray-600 mt-1">There is no wrong answer. Pick the direction that feels right and start building.</p>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          {[
            {
              title: "Keep my current idea",
              desc: "Continue with what you entered. You understand the challenges.",
              path: "current" as PathKey,
            },
            {
              title: "Make a small change",
              desc: "Adjust one thing that could improve your chances without starting over.",
              path: "adjusted" as PathKey,
            },
            {
              title: "Try a different direction",
              desc: "Start from a new angle. Sometimes a small shift opens bigger doors.",
              path: "alternative" as PathKey,
            },
          ].map((card, idx) => (
            <div
              key={card.path}
              className={`rounded-lg border p-4 bg-white ${
                pathChosen === card.path || highlightPath === card.path
                  ? "border-[#1a8c3a] bg-[#f0faf3]"
                  : "border-gray-200"
              }`}
            >
              <p className="font-bold text-gray-900">{card.title}</p>
              <p className="text-sm text-gray-600 mt-2">{card.desc}</p>
              <button
                type="button"
                disabled={pathSelectLoading !== null}
                onClick={() => void handlePathChoose(card.path)}
                className="mt-4 w-full text-sm font-semibold border border-[#1a8c3a] text-[#1a8c3a] rounded-lg py-2 hover:bg-[#f0faf3] disabled:opacity-50"
              >
                {pathSelectLoading === card.path ? "Saving…" : pathChosen === card.path ? "Chosen ✓" : "Choose this"}
              </button>
            </div>
          ))}
        </div>
        {pathSelectError && <p className="text-sm text-red-600 mt-2">{pathSelectError}</p>}
      </section>

      {/* Bottom CTA */}
      <section ref={bottomRef} className="rounded-lg border border-gray-200 bg-[#f0faf3] p-6 space-y-4">
        <p className="text-lg font-semibold text-gray-900 text-center">{bottomCtaSentence(vm.verdict)}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            disabled={launching || data.launchBlocked}
            onClick={onLaunch}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1a8c3a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#157a33] disabled:opacity-50"
          >
            <Rocket className="w-4 h-4" />
            {launching ? "Building your plan…" : "Build My Plan"}
          </button>
          <button
            type="button"
            onClick={() => section8Ref.current?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center gap-2 rounded-lg border border-[#1a8c3a] px-5 py-3 text-sm font-semibold text-[#1a8c3a] bg-white"
          >
            Explore More
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-gray-600 hover:bg-white/80"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </section>
    </div>
  );
}
