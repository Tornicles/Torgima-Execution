import type { ReactNode } from "react";
import { TorgimaPreLaunchLogo } from "@/components/pre-validation/TorgimaPreLaunchLogo";

/** Full-screen pre-launch shell: logo only — no sidebar or app nav. */
export function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-6 py-4">
        <TorgimaPreLaunchLogo />
      </div>
      <main>{children}</main>
    </div>
  );
}
