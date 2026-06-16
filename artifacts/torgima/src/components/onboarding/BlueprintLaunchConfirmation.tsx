import { Rocket } from "lucide-react";
import { LANGUAGE } from "@/lib/language";
import { BLUEPRINT_LABELS, getErectorStateLabel } from "@/lib/language-map";
import { LAUNCH_WHAT_HAPPENS_NEXT, PATH_DIRECTION_LABELS } from "@/lib/onboarding-doc32";
import type { PathKey } from "@/components/validation/PathPanels";

export function BlueprintLaunchConfirmation({
  goalStatement,
  selectedPath,
  archetypeLabel,
  onLaunch,
  launching,
  launchError,
  disabled,
}: {
  goalStatement?: string | null;
  selectedPath?: PathKey | null;
  archetypeLabel?: string | null;
  onLaunch: () => void;
  launching?: boolean;
  launchError?: string | null;
  disabled?: boolean;
}) {
  const pathLabel =
    selectedPath ? PATH_DIRECTION_LABELS[selectedPath] : PATH_DIRECTION_LABELS.adjusted;

  return (
    <section className="mt-10 rounded-[20px] border border-[#ECECF4] bg-[#F8FAFC] p-6 sm:p-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5B21FF]">
        {getErectorStateLabel("LAUNCH_PERMITTED")}
      </p>
      <h2 className="mt-2 text-2xl font-bold text-[#0B1220]">Your project is ready to launch</h2>

      <div className="mt-6 rounded-2xl border border-[#ECECF4] bg-white p-5 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Goal</p>
          <p className="mt-1 text-sm text-[#0B1220]">{goalStatement?.trim() || "Your structured goal"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Selected direction</p>
          <p className="mt-1 text-sm font-semibold text-[#0B1220]">{pathLabel}</p>
        </div>
        {archetypeLabel ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Market context</p>
            <p className="mt-1 text-sm text-[#0B1220]">{archetypeLabel}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-[#0B1220]">What happens next</p>
        <ul className="mt-3 space-y-2 text-sm text-[#64748B] list-disc pl-5">
          {LAUNCH_WHAT_HAPPENS_NEXT.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {launchError ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {launchError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={disabled || launching}
        onClick={onLaunch}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B1220] px-6 py-4 text-base font-bold text-white disabled:opacity-50 sm:w-auto"
      >
        <Rocket className="h-5 w-5" aria-hidden />
        {launching ? LANGUAGE.project.launching : LANGUAGE.project.launch}
      </button>
      <p className="mt-3 text-xs text-[#94A3B8]">
        After launch, your {BLUEPRINT_LABELS.blueprint.toLowerCase()} dashboard unlocks with full execution mode.
      </p>
    </section>
  );
}
