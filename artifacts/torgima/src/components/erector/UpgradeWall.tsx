import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Bookmark, Rocket, Sparkles } from "lucide-react";
import {
  buildSignupUrlWithHandoff,
  createHandoffToken,
} from "@/lib/handoff-client";
import { ERECTOR_LABELS, BLUEPRINT_LABELS } from "@/lib/language-map";

const OPTIONS: Array<{
  id: "free-account" | "pro" | "torgima";
  title: string;
  subtitle: string;
  description: string;
  cta: string;
  href: string;
  icon: typeof Bookmark;
  highlighted?: boolean;
  handoffTarget?: "pro" | "torgima";
}> = [
  {
    id: "free-account",
    title: "Free Account",
    subtitle: "Save your results",
    description: `Create a free account to keep your ${ERECTOR_LABELS.validation_report} summary and continue inside Torgima.`,
    cta: "Create free account",
    href: "/signup",
    icon: Bookmark,
    handoffTarget: "torgima",
  },
  {
    id: "pro",
    title: ERECTOR_LABELS.erector_pro,
    subtitle: "Deep validation without execution",
    description:
      "Get 50 validations per month, an 8-section intake, 14-section intelligence report, and professional PDF export.",
    cta: "Explore Pro",
    href: "/pricing",
    icon: Sparkles,
    highlighted: true,
    handoffTarget: "pro",
  },
  {
    id: "torgima",
    title: "Torgima",
    subtitle: "Validate and execute",
    description: `Run full ${ERECTOR_LABELS.erector_authenticated} inside the dashboard, activate your ${BLUEPRINT_LABELS.blueprint.toLowerCase()}, and get daily execution moves.`,
    cta: "Start with Torgima",
    href: "/signup",
    icon: Rocket,
    handoffTarget: "torgima",
  },
];

type Props = {
  validationId?: string | null;
};

export function UpgradeWall({ validationId }: Props) {
  const [, setLocation] = useLocation();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(option: (typeof OPTIONS)[number]) {
    if (!validationId || !option.handoffTarget) {
      setLocation(option.href);
      return;
    }
    setLoadingId(option.id);
    setError(null);
    try {
      const result = await createHandoffToken("free", option.handoffTarget, validationId);
      setLocation(buildSignupUrlWithHandoff(result.handoff_token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start upgrade handoff.");
      setLoadingId(null);
    }
  }

  return (
    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-[#0EA5E9]">Free checks used</p>
      <h2 className="mt-3 text-2xl font-bold text-[#0A0F1E]">
        You&apos;ve used your 3 free checks. Ready to go deeper?
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">
        Your quick checks gave you a directional read. Choose how you want to continue with deeper{" "}
        {ERECTOR_LABELS.erector_authenticated}.
      </p>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const busy = loadingId === option.id;
          return (
            <div
              key={option.title}
              className={`rounded-2xl border p-6 ${
                option.highlighted ? "border-[#0EA5E9] bg-sky-50/60" : "border-[#E5E7EB] bg-[#FAFAFA]"
              }`}
            >
              <Icon className={`h-6 w-6 ${option.highlighted ? "text-[#0EA5E9]" : "text-[#0A0F1E]"}`} />
              <p className="mt-4 text-lg font-bold text-[#0A0F1E]">{option.title}</p>
              <p className="mt-1 text-sm font-semibold text-gray-600">{option.subtitle}</p>
              <p className="mt-3 text-sm leading-6 text-gray-600">{option.description}</p>
              {validationId && option.handoffTarget ? (
                <button
                  type="button"
                  disabled={Boolean(loadingId)}
                  onClick={() => void handleUpgrade(option)}
                  className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60 ${
                    option.highlighted ? "bg-[#0EA5E9] text-white" : "bg-[#0A0F1E] text-white"
                  }`}
                >
                  {busy ? "Preparing…" : option.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <Link
                  href={option.href}
                  className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold ${
                    option.highlighted ? "bg-[#0EA5E9] text-white" : "bg-[#0A0F1E] text-white"
                  }`}
                >
                  {option.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
