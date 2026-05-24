import { AlignedGoalIntake } from "@/components/onboarding/AlignedGoalIntake";
import { PreLaunchShell } from "@/components/shell/PreLaunchShell";
import { useValidationFlow } from "@/hooks/useValidationFlow";

export default function ValidatePage() {
  const { startValidation, loading, error } = useValidationFlow();

  return (
    <PreLaunchShell step={1}>
      {error && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <p className="text-sm text-red-600 rounded-lg border border-red-100 bg-red-50 px-4 py-3">{error}</p>
        </div>
      )}
      <AlignedGoalIntake onSubmit={(form) => void startValidation(form)} isSubmitting={loading} />
    </PreLaunchShell>
  );
}
