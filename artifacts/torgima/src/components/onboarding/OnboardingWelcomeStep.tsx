import { ArrowRight } from "lucide-react";
import { TorgimaPreLaunchLogo } from "@/components/pre-validation/TorgimaPreLaunchLogo";
import { LANGUAGE } from "@/lib/language";

export function OnboardingWelcomeStep({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
      <TorgimaPreLaunchLogo />
      <h1 className="mt-8 text-3xl font-bold text-[#0B1220]">{LANGUAGE.onboarding.welcomeTitle}</h1>
      <p className="mt-4 text-base text-[#64748B]">{LANGUAGE.onboarding.welcomeSubtitle}</p>
      <button
        type="button"
        onClick={onBegin}
        className="mt-10 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200/60 hover:opacity-95"
      >
        {LANGUAGE.onboarding.beginButton}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
