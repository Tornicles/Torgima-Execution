import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  Calendar,
  Check,
  ClipboardList,
  Clock,
  Globe,
  Lock,
  Pencil,
  PieChart,
  Shield,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import {
  buildSummaryOverviewBullets,
  computeDurationMonths,
  formatDisplayDate,
  keyChallengeFromDraft,
  pacingFullLabel,
  weeklyCommitmentContextLabel,
  weeklyCommitmentPerWeek,
  type PreValidationDraft,
} from "@/lib/pre-validation-draft";
import { PreValidationStepper } from "./PreValidationStepper";
import { TorgimaPreLaunchLogo } from "./TorgimaPreLaunchLogo";

const WHAT_HAPPENS_NEXT = [
  "Analyze your idea against real-world conditions",
  "Identify risks, opportunities, and gaps",
  "Generate 3 optimized directions",
  "Provide a final verdict and recommendations",
  "Prepare the blueprint for execution",
];

function ReviewCard({
  icon: Icon,
  title,
  onEdit,
  children,
  className = "",
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  onEdit: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`relative rounded-[20px] border border-[#E2E8F0] bg-white p-5 shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={onEdit}
        className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#64748B] transition-colors hover:border-[#C7D2FE] hover:text-[#5B21FF]"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
      <div className="flex items-start gap-3 pr-16">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDE9FE] text-[#5B21FF]">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#5B21FF]">{title}</h3>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </article>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="shrink-0 text-xs font-medium text-[#64748B] sm:w-[42%]">{label}</span>
      <span className="text-xs font-medium text-[#0B1220] sm:flex-1">{value || "—"}</span>
    </div>
  );
}

export function PreValidationReviewStep({
  draft,
  onBack,
  onContinue,
  onEditStep,
  continueDisabled = false,
  continueLabel,
}: {
  draft: PreValidationDraft;
  onBack: () => void;
  onContinue: () => void;
  onEditStep: (step: 1 | 2) => void;
  continueDisabled?: boolean;
  continueLabel?: string;
}) {
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const editMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!editMenuRef.current?.contains(e.target as Node)) setEditMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [editMenuOpen]);

  const durationMonths = computeDurationMonths(draft.startDate, draft.endDate);
  const durationLabel = durationMonths === 1 ? "1 Month" : `${durationMonths} Months`;
  const overviewBullets = buildSummaryOverviewBullets(draft);

  const domainLine = [draft.quickContext.domain, draft.quickContext.primaryFocus]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <header className="mx-auto flex max-w-[1536px] flex-wrap items-start justify-between gap-4 px-6 pb-2 pt-6 lg:px-10">
        <TorgimaPreLaunchLogo />
        <div className="hidden flex-1 justify-center lg:flex">
          <PreValidationStepper current={3} />
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-bold text-[#0B1220]">
            <Zap className="h-4 w-4 text-[#5B21FF]" />
            FAST SETUP MODE
          </p>
          <p className="mt-0.5 text-xs font-medium text-[#64748B]">~60 sec</p>
          <p className="text-xs text-[#94A3B8]">to complete</p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 lg:hidden">
        <PreValidationStepper current={3} />
      </div>

      <div className="mx-auto max-w-4xl px-6 pt-8 text-center lg:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5B21FF]">Step 3 of 4</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0B1220] sm:text-3xl">
          Review Your Inputs
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#64748B]">
          Review everything before we analyze your idea and generate optimized directions.
        </p>
      </div>

      <main className="mx-auto grid max-w-[1536px] gap-8 px-6 pb-52 pt-8 lg:grid-cols-[1fr_340px] lg:px-10 xl:gap-10">
        {/* Left: Input Summary */}
        <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDE9FE] text-[#5B21FF]">
              <ClipboardList className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#0B1220]">
                Input Summary
              </h2>
              <p className="mt-1 text-xs text-[#64748B]">
                Please review your entries below. You can edit any section if needed.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ReviewCard icon={Target} title="Goal" onEdit={() => onEditStep(1)}>
              <p className="text-sm leading-relaxed text-[#0B1220]">
                {draft.goal.trim() || "—"}
              </p>
            </ReviewCard>

            <ReviewCard icon={Zap} title="Purpose" onEdit={() => onEditStep(1)}>
              <p className="text-sm leading-relaxed text-[#0B1220]">
                {draft.purpose.trim() || "—"}
              </p>
            </ReviewCard>

            <ReviewCard
              icon={Globe}
              title="Context"
              onEdit={() => onEditStep(2)}
              className="sm:col-span-2"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ContextRow label="Location" value={draft.countryName} />
                <ContextRow label="Current Situation" value={draft.currentSituation} />
                <ContextRow
                  label="Commitment Level"
                  value={weeklyCommitmentContextLabel(draft.weeklyCommitment)}
                />
                <ContextRow label="Business Type / Domain" value={domainLine} />
                <ContextRow
                  label="Target Audience (Primary)"
                  value={draft.quickContext.targetAudience}
                />
                <ContextRow label="Current Stage" value={draft.currentStage} />
                <ContextRow label="Resources Available" value={draft.resourcesAvailable} />
                <ContextRow label="Key Challenge" value={keyChallengeFromDraft(draft)} />
              </div>
            </ReviewCard>

            <ReviewCard icon={Calendar} title="Timeframe" onEdit={() => onEditStep(2)}>
              <div className="space-y-2.5">
                <ContextRow label="Start Date" value={formatDisplayDate(draft.startDate)} />
                <ContextRow label="End Date" value={formatDisplayDate(draft.endDate)} />
                <ContextRow label="Duration" value={durationLabel} />
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <span className="shrink-0 text-xs font-medium text-[#64748B] sm:w-[42%]">
                    Pace / Intensity
                  </span>
                  <span className="inline-flex sm:flex-1">
                    <span className="rounded-full bg-[#F5F3FF] px-3 py-1 text-xs font-semibold text-[#5B21FF]">
                      {pacingFullLabel(draft.pacing)}
                    </span>
                  </span>
                </div>
                <ContextRow
                  label="Weekly Commitment"
                  value={weeklyCommitmentPerWeek(draft.weeklyCommitment)}
                />
              </div>
            </ReviewCard>

            <ReviewCard
              icon={PieChart}
              title="Summary Overview"
              onEdit={() => onEditStep(1)}
              className="sm:col-span-2"
            >
              <ul className="space-y-2 text-sm leading-relaxed text-[#475569]">
                {overviewBullets.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#5B21FF]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </ReviewCard>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#5B21FF]" />
              <div>
                <p className="text-sm font-bold text-[#0B1220]">Almost there!</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#64748B]">
                  Please confirm your information is accurate. You can go back and edit any section.
                </p>
              </div>
            </div>
            <div className="relative" ref={editMenuRef}>
              <button
                type="button"
                onClick={() => setEditMenuOpen((o) => !o)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#5B21FF] shadow-sm hover:bg-[#F5F3FF]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Any Section
              </button>
              {editMenuOpen ? (
                <ul className="absolute right-0 z-20 mt-2 min-w-[200px] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-xl">
                  <li>
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-[#0B1220] hover:bg-[#F5F3FF]"
                      onClick={() => {
                        setEditMenuOpen(false);
                        onEditStep(1);
                      }}
                    >
                      Goal &amp; Purpose
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-[#0B1220] hover:bg-[#F5F3FF]"
                      onClick={() => {
                        setEditMenuOpen(false);
                        onEditStep(2);
                      }}
                    >
                      Context &amp; Timeframe
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#0B1220]">
              What Happens Next
            </h3>
            <p className="mt-1 text-xs text-[#64748B]">Once you validate, TORGIMA will:</p>
            <ul className="mt-4 space-y-3">
              {WHAT_HAPPENS_NEXT.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-xs text-[#475569]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#5B21FF]" strokeWidth={2.5} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 shrink-0 text-[#5B21FF]" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#0B1220]">
                  Your Privacy
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
                  Your data is private and secure.
                  <br />
                  We never store or share your information.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#0B1220]">
              Ready to Validate?
            </h3>
            <p className="mt-1 text-xs text-[#64748B]">This will take less than 2 minutes.</p>
            <button
              type="button"
              onClick={onContinue}
              disabled={continueDisabled}
              className="mt-4 flex w-full flex-col items-center rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-4 py-3.5 text-center shadow-lg shadow-violet-200/60 transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                <Sparkles className="h-4 w-4" />
                Validate My Idea
              </span>
              <span className="mt-1 text-[11px] font-medium text-white/85">
                Start analysis and get your directions
              </span>
            </button>
            <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-[#0B1220]">
                <Clock className="h-4 w-4 text-[#5B21FF]" />
                Est. Time: ~60–90 sec
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
                You&apos;ll receive 3 optimized directions and a final recommendation.
              </p>
            </div>
          </section>
        </aside>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-[1536px] items-center justify-between gap-4 px-6 py-4 lg:px-10">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[#5B21FF]/30 px-6 py-2.5 text-sm font-semibold text-[#5B21FF] hover:bg-[#F5F3FF]"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={continueDisabled}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200/60 hover:opacity-95 disabled:opacity-60"
          >
            {continueLabel ?? "Continue to Validate Idea →"}
          </button>
        </div>
      </div>
    </div>
  );
}
