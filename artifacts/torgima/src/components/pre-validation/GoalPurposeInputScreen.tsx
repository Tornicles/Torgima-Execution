import { useState } from "react";
import {
  BarChart3,
  ChevronDown,
  Crosshair,
  FolderOpen,
  Lightbulb,
  Save,
  Shield,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { TorgimaPreLaunchLogo } from "./TorgimaPreLaunchLogo";
import { PreValidationStepper } from "./PreValidationStepper";
import type { PreValidationDraft, PreValidationQuickContext } from "@/lib/pre-validation-draft";

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

const FOCUS_OPTIONS = [
  "Software product",
  "Mobile app",
  "Online service",
  "Physical product",
  "Content / media",
  "Community platform",
  "Coaching program",
  "Agency services",
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

const EXPERIENCE_OPTIONS = ["Just starting", "Some experience", "Experienced", "Expert / serial builder"];

function ContextDropdown({
  icon: Icon,
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm transition-shadow hover:border-[#C7D2FE]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDE9FE] text-[#5B21FF]">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-[#0B1220]">{label}</span>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`mt-0.5 w-full cursor-pointer appearance-none bg-transparent text-sm outline-none ${
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
        <ChevronDown className="h-5 w-5 shrink-0 text-[#94A3B8]" aria-hidden />
      </div>
    </label>
  );
}

function TipBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-[#F5F3FF] px-4 py-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#5B21FF]">
        <Lightbulb className="h-4 w-4 shrink-0" />
        {title}
      </p>
      <ul className="mt-2 space-y-1 text-sm leading-relaxed text-[#475569]">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

export function GoalPurposeInputScreen({
  draft,
  onDraftChange,
  onSaveDraft,
  onContinue,
}: {
  draft: PreValidationDraft;
  onDraftChange: (patch: Partial<PreValidationDraft>) => void;
  onSaveDraft: () => void;
  onContinue: () => void;
}) {
  const [errors, setErrors] = useState<{ goal?: string; purpose?: string }>({});

  function updateQuickContext(patch: Partial<PreValidationQuickContext>) {
    onDraftChange({
      quickContext: { ...draft.quickContext, ...patch },
    });
  }

  function handleContinue() {
    const next: { goal?: string; purpose?: string } = {};
    if (!draft.goal.trim()) next.goal = "Enter your goal before continuing.";
    if (!draft.purpose.trim()) next.purpose = "Enter your purpose before continuing.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onContinue();
  }

  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <header className="mx-auto flex max-w-[1536px] flex-wrap items-start justify-between gap-4 px-6 pb-2 pt-6 lg:px-10">
        <TorgimaPreLaunchLogo />
        <div className="hidden flex-1 justify-center lg:flex">
          <PreValidationStepper current={1} />
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

      <div className="mx-auto max-w-4xl px-6 pt-6 text-center lg:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5B21FF]">Step 1 of 4</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0B1220] sm:text-3xl lg:text-[2rem]">
          DEFINE YOUR GOAL &amp; PURPOSE
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#64748B] sm:text-base">
          Every great execution begins with a clear goal and a powerful purpose.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-3xl px-4 lg:hidden">
        <PreValidationStepper current={1} />
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-44 pt-10 lg:px-10">
        <section className="overflow-hidden rounded-[22px] border border-[#E2E8F0] bg-white shadow-sm">
          <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-[#E2E8F0]">
            <div className="space-y-5 p-6 sm:p-8 lg:p-10">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EDE9FE] text-[#5B21FF]">
                  <Target className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#0B1220]">1. YOUR GOAL</h2>
                  <p className="mt-1 text-sm text-[#64748B]">What do you want to achieve?</p>
                </div>
              </div>
              <div data-field="goal">
                <textarea
                  value={draft.goal}
                  onChange={(e) => {
                    onDraftChange({ goal: e.target.value.slice(0, 200) });
                    if (errors.goal) setErrors((prev) => ({ ...prev, goal: undefined }));
                  }}
                  rows={6}
                  placeholder="Describe your main goal in one clear statement."
                  className="w-full resize-none rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] px-4 py-3.5 text-sm leading-relaxed text-[#0B1220] placeholder:text-[#94A3B8] outline-none transition-colors focus:border-[#5B21FF] focus:ring-2 focus:ring-[#5B21FF]/15"
                />
                <p className="mt-2 text-right text-xs text-[#94A3B8]">
                  {draft.goal.length} / 200
                </p>
                {errors.goal ? <p className="text-xs text-red-600">{errors.goal}</p> : null}
              </div>
              <TipBox
                title="Tips for a powerful goal"
                items={[
                  "Be specific about the outcome",
                  "Focus on what you want to create or achieve",
                  "Think long-term impact, not just short-term results",
                ]}
              />
            </div>

            <div className="space-y-5 border-t border-[#E2E8F0] p-6 sm:p-8 lg:border-t-0 lg:p-10">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EDE9FE] text-[#5B21FF]">
                  <Star className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#0B1220]">2. YOUR PURPOSE</h2>
                  <p className="mt-1 text-sm text-[#64748B]">Why is this goal important to you?</p>
                </div>
              </div>
              <div data-field="purpose">
                <textarea
                  value={draft.purpose}
                  onChange={(e) => {
                    onDraftChange({ purpose: e.target.value.slice(0, 300) });
                    if (errors.purpose) setErrors((prev) => ({ ...prev, purpose: undefined }));
                  }}
                  rows={6}
                  placeholder="Explain your deeper purpose and the reason behind this goal."
                  className="w-full resize-none rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] px-4 py-3.5 text-sm leading-relaxed text-[#0B1220] placeholder:text-[#94A3B8] outline-none transition-colors focus:border-[#5B21FF] focus:ring-2 focus:ring-[#5B21FF]/15"
                />
                <p className="mt-2 text-right text-xs text-[#94A3B8]">
                  {draft.purpose.length} / 300
                </p>
                {errors.purpose ? <p className="text-xs text-red-600">{errors.purpose}</p> : null}
              </div>
              <TipBox
                title="Tips for a powerful purpose"
                items={[
                  "Connect to your values and vision",
                  "Think about the change you want to create",
                  "Focus on who this will impact and why it matters",
                ]}
              />
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[22px] border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-8">
          <h3 className="text-sm font-bold tracking-wide text-[#0B1220]">QUICK CONTEXT (OPTIONAL)</h3>
          <p className="mt-1 text-sm text-[#64748B]">
            Add a few details to help us understand your situation better.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ContextDropdown
              icon={FolderOpen}
              label="Industry / Domain"
              value={draft.quickContext.domain}
              placeholder="Select your domain"
              options={DOMAIN_OPTIONS}
              onChange={(domain) => updateQuickContext({ domain })}
            />
            <ContextDropdown
              icon={Crosshair}
              label="Primary Focus"
              value={draft.quickContext.primaryFocus}
              placeholder="What will you create / provide?"
              options={FOCUS_OPTIONS}
              onChange={(primaryFocus) => updateQuickContext({ primaryFocus })}
            />
            <ContextDropdown
              icon={Users}
              label="Target Audience"
              value={draft.quickContext.targetAudience}
              placeholder="Who are you serving?"
              options={AUDIENCE_OPTIONS}
              onChange={(targetAudience) => updateQuickContext({ targetAudience })}
            />
            <ContextDropdown
              icon={BarChart3}
              label="Experience Level"
              value={draft.quickContext.experienceLevel}
              placeholder="Your current level"
              options={EXPERIENCE_OPTIONS}
              onChange={(experienceLevel) => updateQuickContext({ experienceLevel })}
            />
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E2E8F0] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <div className="flex min-w-[200px] items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#5B21FF]" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-semibold text-[#0B1220]">Your data is private and secure</p>
              <p className="text-xs text-[#64748B]">We never store or share your information.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSaveDraft}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-[#0B1220] shadow-sm transition-colors hover:border-[#C7D2FE] hover:bg-[#F8FAFC]"
          >
            <Save className="h-4 w-4 text-[#5B21FF]" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200/60 transition-opacity hover:opacity-95"
          >
            <Sparkles className="h-4 w-4" />
            Continue to Next Step
            <span aria-hidden>→</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
