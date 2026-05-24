import { useMemo, useRef, useState } from "react";
import {
  BarChart2,
  Calendar,
  RefreshCw,
  Rocket,
  Shield,
  Target,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import type { CommitmentKey } from "./erector-intake-types";

const COUNTRIES = [
  { code: "US", flag: "🇺🇸", name: "United States" },
  { code: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "AE", flag: "🇦🇪", name: "United Arab Emirates" },
];

const BUSINESS_TYPES = [
  "SaaS",
  "Education",
  "Coaching",
  "Online Services",
  "Ecommerce",
  "Content",
  "Consulting",
  "Marketplace",
  "Local Business",
  "Finance",
  "Health",
  "Other",
];

const PACE_MAP: Record<string, CommitmentKey> = {
  Slow: "LOW",
  Moderate: "MEDIUM",
  Fast: "HIGH",
  Intense: "INTENSE",
};

const COMMITMENT_MAP: Record<string, CommitmentKey> = {
  "Low (5-10 hrs/week)": "LOW",
  "Medium (10-20 hrs/week)": "MEDIUM",
  "High (15+ hrs/week)": "HIGH",
  "Full-time (40+ hrs/week)": "INTENSE",
};

export type AlignedIntakeForm = {
  rawGoal: string;
  purpose: string;
  startDate: string;
  endDate: string;
  pace: string;
  commitmentLevel: CommitmentKey;
  locationCountry: string;
  businessModel: string;
};

export function AlignedGoalIntake({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (form: AlignedIntakeForm) => void;
  isSubmitting?: boolean;
}) {
  const idempotencyRef = useRef(crypto.randomUUID());
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultEnd = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [form, setForm] = useState<AlignedIntakeForm>({
    rawGoal: "",
    purpose: "",
    startDate: today,
    endDate: defaultEnd,
    pace: "Moderate",
    commitmentLevel: "MEDIUM",
    locationCountry: "",
    businessModel: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof AlignedIntakeForm, string>>>({});

  const durationLabel = useMemo(() => {
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return "Auto calculated";
    const months = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30 * 24 * 3600 * 1000)));
    return months === 1 ? "1 Month" : `${months} Months`;
  }, [form.startDate, form.endDate]);

  function validate(): boolean {
    const next: Partial<Record<keyof AlignedIntakeForm, string>> = {};
    if (form.rawGoal.trim().length < 20) next.rawGoal = "Goal must be at least 20 characters.";
    if (form.purpose.trim().length < 20) next.purpose = "Purpose must be at least 20 characters.";
    if (!form.locationCountry.trim()) next.locationCountry = "Location is required.";
    if (!form.businessModel.trim()) next.businessModel = "Business type is required.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = Object.keys(next)[0];
      document.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function handleStart() {
    if (!validate()) return;
    const commitment = COMMITMENT_MAP[form.commitmentLevel as unknown as string] ?? PACE_MAP[form.pace] ?? form.commitmentLevel;
    onSubmit({
      ...form,
      commitmentLevel: commitment,
    });
    void idempotencyRef.current;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 pb-32">
      <div className="flex items-center gap-3 mb-8 text-sm">
        {["INPUT DETAILS", "VALIDATION", "RESULTS", "LAUNCH"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                i === 0 ? "bg-violet-600 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            <span className={i === 0 ? "font-semibold text-gray-900" : "text-gray-400"}>{label}</span>
            {i < 3 && <span className="text-gray-300 mx-1">→</span>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
        <div className="flex gap-4 max-w-xl">
          <Rocket className="w-10 h-10 text-violet-600 shrink-0" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Let&apos;s Validate Your Idea</h1>
            <p className="text-gray-600 mt-2 text-sm leading-relaxed">
              Provide a few key details below. Our system will run a fast reality check and show you the best direction to
              move forward.
            </p>
          </div>
        </div>
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4 max-w-xs flex gap-3">
          <Zap className="w-6 h-6 text-green-600 shrink-0" />
          <div>
            <p className="font-bold text-green-800">Fast. Focused. Real.</p>
            <p className="text-xs text-green-700 mt-1">Operational validation grounded in economy and market reality.</p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-green-600" />
          <h2 className="text-sm font-bold tracking-wide text-gray-800">1. WHAT ARE YOU TRYING TO ACHIEVE?</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div data-field="rawGoal">
            <label className="text-sm font-semibold text-gray-800">Goal *</label>
            <p className="text-xs text-gray-500 mb-2">What do you want to achieve?</p>
            <textarea
              value={form.rawGoal}
              onChange={(e) => setForm((f) => ({ ...f, rawGoal: e.target.value.slice(0, 200) }))}
              rows={5}
              placeholder="e.g. Launch a B2B SaaS that helps small clinics manage patient follow-ups"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{form.rawGoal.length}/200</p>
            {errors.rawGoal && <p className="text-xs text-red-600">{errors.rawGoal}</p>}
          </div>
          <div data-field="purpose">
            <label className="text-sm font-semibold text-gray-800">Purpose *</label>
            <p className="text-xs text-gray-500 mb-2">Why do you want to achieve this?</p>
            <textarea
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value.slice(0, 300) }))}
              rows={5}
              placeholder="e.g. Reduce admin burden so clinicians can focus on care quality"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{form.purpose.length}/300</p>
            {errors.purpose && <p className="text-xs text-red-600">{errors.purpose}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-bold tracking-wide text-gray-800">2. TIMEFRAME</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold">Start Date *</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">End Date *</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Duration</label>
            <p className="mt-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
              {durationLabel}
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold">Pace / Urgency *</label>
            <p className="text-xs text-gray-500 mb-1">How fast do you want to move?</p>
            <select
              value={form.pace}
              onChange={(e) => {
                const pace = e.target.value;
                setForm((f) => ({
                  ...f,
                  pace,
                  commitmentLevel: PACE_MAP[pace] ?? f.commitmentLevel,
                }));
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {Object.keys(PACE_MAP).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-violet-600" />
          <h2 className="text-sm font-bold tracking-wide text-gray-800">3. CONTEXT (MINIMAL)</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div data-field="locationCountry">
            <label className="text-sm font-semibold">Location *</label>
            <p className="text-xs text-gray-500 mb-1">Where are you based?</p>
            <select
              value={form.locationCountry}
              onChange={(e) => setForm((f) => ({ ...f, locationCountry: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            {errors.locationCountry && <p className="text-xs text-red-600 mt-1">{errors.locationCountry}</p>}
          </div>
          <div>
            <label className="text-sm font-semibold">Commitment Level *</label>
            <p className="text-xs text-gray-500 mb-1">How committed can you be?</p>
            <select
              value={
                Object.entries(COMMITMENT_MAP).find(([, v]) => v === form.commitmentLevel)?.[0] ??
                "Medium (10-20 hrs/week)"
              }
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  commitmentLevel: COMMITMENT_MAP[e.target.value] ?? "MEDIUM",
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {Object.keys(COMMITMENT_MAP).map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div data-field="businessModel">
            <label className="text-sm font-semibold">Business Type / Domain *</label>
            <p className="text-xs text-gray-500 mb-1">What type of business is this?</p>
            <select
              value={form.businessModel}
              onChange={(e) => setForm((f) => ({ ...f, businessModel: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Select type</option>
              {BUSINESS_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {errors.businessModel && <p className="text-xs text-red-600 mt-1">{errors.businessModel}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <p className="text-sm font-bold text-green-700 flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4" />
          What happens next?
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {[
            { icon: TrendingUp, title: "We analyse your idea", sub: "against real market data" },
            { icon: Shield, title: "Identify opportunities", sub: "risks and the best path" },
            { icon: RefreshCw, title: "Give you 3 directions", sub: "with outcome projections" },
            { icon: Rocket, title: "You decide", sub: "Launch or download report" },
          ].map(({ icon: Icon, title, sub }) => (
            <div key={title} className="flex gap-2">
              <Icon className="w-5 h-5 text-violet-600 shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">{title}</p>
                <p className="text-xs text-gray-500">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="fixed bottom-0 left-[200px] right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-600 flex items-center gap-2">
          <span className="text-green-600">✓</span>
          All fields are required to run validation
        </p>
        <p className="text-xs text-gray-500">Takes less than 2 minutes</p>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleStart}
          className="rounded-lg bg-violet-600 text-white font-semibold px-6 py-3 hover:bg-violet-700 disabled:opacity-50 text-sm"
        >
          {isSubmitting ? "Starting validation…" : "Start Validation →"}
        </button>
      </div>
    </div>
  );
}
