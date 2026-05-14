import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useBlueprintStore } from "@/store/blueprintStore";

/** Sidebar "Blueprint" → active blueprint detail, or prompt when none. */
export default function BlueprintIndexPage() {
  const activeBlueprintId = useBlueprintStore((s) => s.activeBlueprintId);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (activeBlueprintId) setLocation(`/blueprint/${activeBlueprintId}`);
  }, [activeBlueprintId, setLocation]);

  if (activeBlueprintId) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[40vh] text-gray-500 text-sm">
        Opening blueprint…
      </div>
    );
  }

  return (
    <div className="p-8 max-w-lg mx-auto text-center space-y-4">
      <p className="text-gray-700 font-medium">No active blueprint</p>
      <p className="text-sm text-gray-500">Create or activate a blueprint to see the overview.</p>
      <Link href="/onboarding">
        <span className="inline-block bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer hover:bg-gray-800">
          Start onboarding
        </span>
      </Link>
    </div>
  );
}
