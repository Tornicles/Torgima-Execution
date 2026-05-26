import { useState } from "react";
import { useLocation } from "wouter";
import {
  postBhudhiLaunchOnboard,
  type BhudhiPricingTierId,
} from "@/lib/bhudhi-launch-api";
import { trackBhudhiEvent } from "@/lib/bhudhi-telemetry";
type Step = 1 | 2 | 3 | 4;

const TIERS: BhudhiPricingTierId[] = ["free", "pro", "enterprise"];

export default function BhudhiLaunchOnboardingPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    useCase: "",
    tier: "free" as BhudhiPricingTierId,
  });

  const handleNext = async () => {
    if (step < 4) {
      setStep((step + 1) as Step);
      trackBhudhiEvent("bhudhi.onboarding.step", { properties: { step: step + 1 } });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await postBhudhiLaunchOnboard({
        name: form.name.trim(),
        organization: form.organization.trim() || undefined,
        useCase: form.useCase.trim(),
        tier: form.tier,
      });
      trackBhudhiEvent("bhudhi.onboarding.complete", { properties: { tier: form.tier } });
      setLocation(result.redirect || "/app/bhudhi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onboarding failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const canAdvance =
    (step === 1 && form.name.trim().length > 0 && form.email.includes("@")) ||
    (step === 2 && true) ||
    (step === 3 && form.useCase.trim().length >= 5) ||
    step === 4;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-light mb-2">Welcome to Bhudhi</h1>
          <p className="text-lg text-gray-600">Step {step} of 4</p>
        </div>

        <div className="flex gap-2 mb-12">
          {([1, 2, 3, 4] as const).map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition ${
                s <= step ? "bg-slate-800" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="mb-12">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-light">Tell us about yourself</h2>
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="email"
                placeholder="Email (for your account)"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-light">Your organization</h2>
              <input
                type="text"
                placeholder="Organization name (optional)"
                value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-light">What will you use Bhudhi for?</h2>
              <textarea
                placeholder="Describe your use case…"
                value={form.useCase}
                onChange={(e) => setForm({ ...form, useCase: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg h-32"
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-light">Choose your plan</h2>
              <p className="text-sm text-gray-500">
                Maps to Torgima tiers: Free → starter, Pro → growth, Enterprise → ultimate.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setForm({ ...form, tier })}
                    className={`border rounded-lg p-6 text-left transition ${
                      form.tier === tier
                        ? "border-slate-800 bg-slate-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <h3 className="font-medium capitalize">{tier}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {tier === "free"
                        ? "Get started"
                        : tier === "pro"
                          ? "For teams"
                          : "Enterprise scale"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-4">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={!canAdvance || submitting}
            className="flex-1 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50"
          >
            {step === 4 ? (submitting ? "Saving…" : "Complete setup") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
