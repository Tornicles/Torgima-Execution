import type { ReactNode } from "react";
import { TopProgressRail, type FlowStepId } from "./TopProgressRail";

export function OnboardingShell({
  children,
  flowStep,
  maxReachableStep,
  onFlowStepClick,
}: {
  children: ReactNode;
  flowStep: FlowStepId;
  maxReachableStep?: FlowStepId;
  onFlowStepClick?: (step: FlowStepId) => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 border-b border-gray-200 bg-white flex items-center px-6 shrink-0">
        <div>
          <p className="text-xs font-bold tracking-widest text-violet-700 leading-none">ERECTOR</p>
          <p className="text-sm font-bold text-gray-900 leading-tight">TORGIMA</p>
        </div>
      </header>

      <TopProgressRail
        currentStep={flowStep}
        maxReachableStep={maxReachableStep}
        onStepClick={onFlowStepClick}
      />

      <main className="flex-1 overflow-y-auto w-full">{children}</main>
    </div>
  );
}
