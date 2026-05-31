import { useMemo, useState, type ComponentType } from "react";
import {
  Briefcase,
  Calendar,
  ChevronDown,
  Clock,
  FileText,
  Gauge,
  Globe,
  Lock,
  MapPin,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { CountrySelector } from "@/components/onboarding/CountrySelector";
import type { CountrySelection } from "@/lib/countries";
import {
  computeDurationDays,
  computeDurationMonths,
  formatDisplayDate,
  pacingDisplayLabel,
  weeklyCommitmentLabel,
  type PreValidationDraft,
  type PacingKey,
  type WeeklyCommitmentKey,
} from "@/lib/pre-validation-draft";
import { PreValidationStepper } from "./PreValidationStepper";
import { TorgimaPreLaunchLogo } from "./TorgimaPreLaunchLogo";

const DOMAIN_OPTIONS = [
  "SaaS",
  "Education",
  "Coaching",
  "Ecommerce",
  "Content",
  "Consulting",
  "Health & Fitness",
  "Finance",
  "Marketplace",
  "Local Business",
  "Other",
];

const SITUATION_OPTIONS = [
  "Full-time employed",
  "Part-time / side project",
  "Student",
  "Between jobs",
  "Full-time founder",
  "Freelancer / consultant",
];

const STAGE_OPTIONS = [
  "Just an idea",
  "Validating the idea",
  "Building MVP",
  "Early customers",
  "Growing revenue",
  "Scaling",
];

const RESOURCES_OPTIONS = [
  "Limited budget",
  "Moderate budget",
  "Strong funding",
  "Technical skills",
  "Small team",
  "Solo founder",
  "Existing audience",
];

const AUDIENCE_OPTIONS = [
  "Consumers / individuals",
  "Small businesses",
  "Startups & founders",
  "Professionals",
  "Students",
  "Global market",
  "Local community",
];

const PACING_OPTIONS: { key: PacingKey; label: string; sub: string }[] = [
  { key: "LIGHT", label: "Light", sub: "Steady" },
  { key: "FOCUSED", label: "Focused", sub: "Balanced" },
  { key: "INTENSE", label: "Intense", sub: "Fast" },
  { key: "AGGRESSIVE", label: "Aggressive", sub: "Maximum" },
];

const WEEKLY_OPTIONS: { key: WeeklyCommitmentKey; hrs: string; label: string }[] = [
  { key: "LIGHT", hrs: "5–10 hrs", label: "Light" },
  { key: "MODERATE", hrs: "10–20 hrs", label: "Moderate" },
  { key: "HIGH", hrs: "20–30 hrs", label: "High" },
  { key: "INTENSIVE", hrs: "30+ hrs", label: "Intensive" },
];

const ENV_EXAMPLES = [
  "Highly competitive market",
  "Early stage idea",
  "Limited budget",
  "Growing audience",
  "Busy schedule",
  "Regulated industry",
];

function IconSelectField({
  icon: Icon,
  label,
  value,
  placeholder,
  options,
  onChange,
  error,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <div
        className={`flex items-center gap-3 rounded-2xl border bg-white px-3 py-2.5 shadow-sm transition-colors ${
          error ? "border-red-300" : "border-[#E2E8F0] hover:border-[#C7D2FE]"
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDE9FE] text-[#5B21FF]">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-[#0B1220]">{label}</span>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`mt-0.5 w-full cursor-pointer appearance-none bg-transparent text-xs outline-none sm:text-sm ${
              value ? "font-medium text-[#0B1220]" : "text-[#94A3B8]"
            }`}
          >
            <option value="">{placeholder}</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </label>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
      <span className="text-[#64748B]">
        {label}: <span className="font-medium text-[#0B1220]">{value || "—"}</span>
      </span>
    </div>
  );
}

export function ContextTimeframeInputScreen({
  draft,
  onDraftChange,
  onBack,
  onContinue,
}: {
  draft: PreValidationDraft;
  onDraftChange: (patch: Partial<PreValidationDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const country: CountrySelection | null = draft.countryName
    ? { countryName: draft.countryName, countryCode: draft.countryCode ?? "" }
    : null;

  const durationMonths = useMemo(
    () => computeDurationMonths(draft.startDate, draft.endDate),
    [draft.startDate, draft.endDate],
  );

  const durationLabel = durationMonths === 1 ? "1 Month" : `${durationMonths} Months`;

  function toggleEnvTag(tag: string) {
    const tags = draft.environmentTags.includes(tag)
      ? draft.environmentTags.filter((t) => t !== tag)
      : [...draft.environmentTags, tag];
    onDraftChange({ environmentTags: tags });
  }

  function handleContinue() {
    const next: Record<string, string> = {};
    if (!draft.countryName.trim()) next.location = "Select your location (country).";
    if (!draft.quickContext.domain.trim()) next.domain = "Select your business type / domain.";
    if (!draft.currentStage.trim()) next.currentStage = "Select your current stage.";
    if (!draft.startDate) next.startDate = "Start date is required.";
    if (!draft.endDate) next.endDate = "End date is required.";
    if (draft.startDate && draft.endDate && new Date(draft.endDate) <= new Date(draft.startDate)) {
      next.endDate = "End date must be after start date.";
    }
    if (!draft.pacing) next.pacing = "Select your pacing.";
    if (!draft.weeklyCommitment) next.weeklyCommitment = "Select your weekly commitment.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const days = computeDurationDays(draft.startDate, draft.endDate);
    const envParts = [
      draft.environmentDescription.trim(),
      ...draft.environmentTags,
      draft.currentSituation && `Situation: ${draft.currentSituation}`,
      draft.resourcesAvailable && `Resources: ${draft.resourcesAvailable}`,
    ].filter(Boolean);

    onDraftChange({
      timeframeDays: days,
      commitment: draft.weeklyCommitment,
      currentContext: envParts.join("\n"),
    });
    onContinue();
  }

  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <header className="mx-auto flex max-w-[1536px] flex-wrap items-start justify-between gap-4 px-6 pb-2 pt-6 lg:px-10">
        <TorgimaPreLaunchLogo />
        <div className="hidden flex-1 justify-center lg:flex">
          <PreValidationStepper current={2} />
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
        <PreValidationStepper current={2} />
      </div>

      <div className="mx-auto max-w-4xl px-6 pt-8 text-center lg:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5B21FF]">Step 2 of 4</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0B1220] sm:text-3xl">
          Define Your Context &amp; Timeframe
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#64748B]">
          Help us understand your current situation, environment, and the time window you&apos;re working with.
        </p>
      </div>

      <main className="mx-auto grid max-w-[1536px] gap-6 px-6 pb-52 pt-8 lg:grid-cols-[1fr_340px_280px] lg:px-10 xl:gap-8">
        {/* Left: Situation & Environment */}
        <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EDE9FE] text-[#5B21FF]">
              <Globe className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#0B1220]">Your Situation &amp; Environment</h2>
              <p className="mt-1 text-sm text-[#64748B]">Tell us about your current context.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className={errors.location ? "sm:col-span-2" : ""}>
              <CountrySelector
                theme="light"
                label="Location"
                placeholder="Where are you based?"
                value={country}
                onChange={(c) => {
                  onDraftChange({
                    countryName: c?.countryName ?? "",
                    countryCode: c?.countryCode,
                  });
                  if (errors.location) {
                    setErrors((e) => {
                      const next = { ...e };
                      delete next.location;
                      return next;
                    });
                  }
                }}
                error={errors.location}
              />
            </div>
            <IconSelectField
              icon={MapPin}
              label="Current Situation"
              value={draft.currentSituation}
              placeholder="What's your current situation?"
              options={SITUATION_OPTIONS}
              onChange={(currentSituation) => onDraftChange({ currentSituation })}
            />
            <IconSelectField
              icon={Briefcase}
              label="Business Type / Domain"
              value={draft.quickContext.domain}
              placeholder="What type of business or domain?"
              options={DOMAIN_OPTIONS}
              onChange={(domain) =>
                onDraftChange({
                  quickContext: { ...draft.quickContext, domain },
                })
              }
              error={errors.domain}
            />
            <IconSelectField
              icon={Users}
              label="Target Audience (Primary)"
              value={draft.quickContext.targetAudience}
              placeholder="Who are you serving?"
              options={AUDIENCE_OPTIONS}
              onChange={(targetAudience) =>
                onDraftChange({
                  quickContext: { ...draft.quickContext, targetAudience },
                })
              }
            />
            <IconSelectField
              icon={TrendingUp}
              label="Current Stage"
              value={draft.currentStage}
              placeholder="Where are you in your journey?"
              options={STAGE_OPTIONS}
              onChange={(currentStage) => onDraftChange({ currentStage })}
              error={errors.currentStage}
            />
            <IconSelectField
              icon={Wallet}
              label="Resources Available"
              value={draft.resourcesAvailable}
              placeholder="What resources do you have now?"
              options={RESOURCES_OPTIONS}
              onChange={(resourcesAvailable) => onDraftChange({ resourcesAvailable })}
            />
          </div>

          <div className="mt-8">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#5B21FF]" />
              <h3 className="text-sm font-bold text-[#0B1220]">Describe Your Environment</h3>
            </div>
            <p className="mt-1 text-xs text-[#64748B]">
              Give us more details about your situation, challenges, and what&apos;s around you.
            </p>
            <textarea
              value={draft.environmentDescription}
              onChange={(e) =>
                onDraftChange({ environmentDescription: e.target.value.slice(0, 500) })
              }
              rows={5}
              placeholder="Describe your environment, market conditions, current challenges, opportunities you see, and anything important we should know..."
              className="mt-3 w-full resize-none rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] px-4 py-3 text-sm leading-relaxed outline-none focus:border-[#5B21FF] focus:ring-2 focus:ring-[#5B21FF]/15"
            />
            <p className="mt-1 text-right text-xs text-[#94A3B8]">
              {draft.environmentDescription.length} / 500
            </p>
            <p className="mt-4 text-xs font-semibold text-[#64748B]">Examples:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ENV_EXAMPLES.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleEnvTag(tag)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    draft.environmentTags.includes(tag)
                      ? "border-[#5B21FF] bg-[#F5F3FF] text-[#5B21FF]"
                      : "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#C7D2FE]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Middle: Timeframe */}
        <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDE9FE] text-[#5B21FF]">
              <Calendar className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#0B1220]">Your Timeframe</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">Define your execution window and pace.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-[#0B1220]">Start Date</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => onDraftChange({ startDate: e.target.value })}
                className="mt-1.5 w-full rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] px-4 py-2.5 text-sm outline-none focus:border-[#5B21FF] focus:ring-2 focus:ring-[#5B21FF]/15"
              />
              {errors.startDate ? <p className="mt-1 text-xs text-red-600">{errors.startDate}</p> : null}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#0B1220]">End Date</span>
              <input
                type="date"
                value={draft.endDate}
                onChange={(e) => onDraftChange({ endDate: e.target.value })}
                className="mt-1.5 w-full rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] px-4 py-2.5 text-sm outline-none focus:border-[#5B21FF] focus:ring-2 focus:ring-[#5B21FF]/15"
              />
              {errors.endDate ? <p className="mt-1 text-xs text-red-600">{errors.endDate}</p> : null}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] px-3 py-3">
                <div className="flex items-center gap-2 text-[#5B21FF]">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-semibold text-[#0B1220]">Duration</span>
                </div>
                <p className="mt-1 text-sm font-bold text-[#0B1220]">{durationLabel}</p>
              </div>
              <label className="rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] px-3 py-3">
                <div className="flex items-center gap-2 text-[#5B21FF]">
                  <Gauge className="h-4 w-4" />
                  <span className="text-xs font-semibold text-[#0B1220]">Pacing</span>
                </div>
                <select
                  value={draft.pacing}
                  onChange={(e) => onDraftChange({ pacing: e.target.value as PacingKey })}
                  className="mt-1 w-full bg-transparent text-sm font-bold text-[#0B1220] outline-none"
                >
                  {PACING_OPTIONS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label} / {p.sub}
                    </option>
                  ))}
                </select>
                {errors.pacing ? <p className="mt-1 text-xs text-red-600">{errors.pacing}</p> : null}
              </label>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#0B1220]">
                How much time can you realistically dedicate each week?
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {WEEKLY_OPTIONS.map((opt) => {
                  const selected = draft.weeklyCommitment === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() =>
                        onDraftChange({
                          weeklyCommitment: opt.key,
                          commitment: opt.key,
                        })
                      }
                      className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                        selected
                          ? "border-[#5B21FF] bg-[#F5F3FF] shadow-sm"
                          : "border-[#E2E8F0] bg-white hover:border-[#C7D2FE]"
                      }`}
                    >
                      <p className={`text-sm font-bold ${selected ? "text-[#5B21FF]" : "text-[#0B1220]"}`}>
                        {opt.hrs}
                      </p>
                      <p className={`text-xs ${selected ? "text-[#5B21FF]/80" : "text-[#64748B]"}`}>
                        {opt.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-[#F5F3FF] px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#5B21FF]">
                <Sparkles className="h-4 w-4" />
                Why this matters
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#475569]">
                This helps TORGIMA design a realistic execution plan that fits your time and energy.
              </p>
            </div>
          </div>
        </section>

        {/* Right: Summary */}
        <aside className="rounded-[22px] border border-[#E2E8F0] bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#5B21FF]">
            Your Input Summary
          </h3>
          <p className="mt-1 text-xs text-[#64748B]">Here&apos;s a quick overview of what you&apos;ve entered.</p>

          <div className="mt-5 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Goal</p>
              <p className="mt-1 text-xs leading-relaxed text-[#0B1220] line-clamp-3">
                {draft.goal.trim() || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Purpose</p>
              <p className="mt-1 text-xs leading-relaxed text-[#0B1220] line-clamp-3">
                {draft.purpose.trim() || "—"}
              </p>
            </div>
          </div>

          <hr className="my-4 border-[#E2E8F0]" />

          <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Context</p>
          <div className="mt-2 space-y-1.5">
            <SummaryRow icon={Globe} label="Location" value={draft.countryName} />
            <SummaryRow icon={MapPin} label="Situation" value={draft.currentSituation} />
            <SummaryRow icon={Briefcase} label="Domain" value={draft.quickContext.domain} />
            <SummaryRow icon={Users} label="Audience" value={draft.quickContext.targetAudience} />
            <SummaryRow icon={TrendingUp} label="Stage" value={draft.currentStage} />
            <SummaryRow icon={Wallet} label="Resources" value={draft.resourcesAvailable} />
          </div>

          <hr className="my-4 border-[#E2E8F0]" />

          <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Timeframe</p>
          <div className="mt-2 space-y-1.5">
            <SummaryRow icon={Calendar} label="Start" value={formatDisplayDate(draft.startDate)} />
            <SummaryRow icon={Calendar} label="End" value={formatDisplayDate(draft.endDate)} />
            <SummaryRow icon={Clock} label="Duration" value={durationLabel} />
            <SummaryRow icon={Gauge} label="Pacing" value={pacingDisplayLabel(draft.pacing)} />
            <SummaryRow
              icon={Target}
              label="Weekly Commitment"
              value={weeklyCommitmentLabel(draft.weeklyCommitment)}
            />
          </div>
        </aside>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white">
        <div className="border-t border-[#E2E8F0] bg-[#F0F9FF]/60 px-6 py-4 lg:px-10">
          <div className="mx-auto flex max-w-[1536px] flex-wrap items-start justify-between gap-4">
            <div className="flex max-w-md items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#5B21FF]" />
              <p className="text-xs leading-relaxed text-[#475569]">
                The more accurate your context and timeframe, the more precise and realistic your execution
                blueprint will be. You can always adjust these later.
              </p>
            </div>
            <div className="flex items-start gap-2 text-xs text-[#64748B]">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#5B21FF]" />
              <span>
                Your data is private and secure.
                <br />
                We never store or share your information.
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-[#E2E8F0] px-6 py-4 lg:px-10">
          <div className="mx-auto flex max-w-[1536px] items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#5B21FF]/30 px-6 py-2.5 text-sm font-semibold text-[#5B21FF] hover:bg-[#F5F3FF]"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200/60 hover:opacity-95"
            >
              Continue to Review →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
