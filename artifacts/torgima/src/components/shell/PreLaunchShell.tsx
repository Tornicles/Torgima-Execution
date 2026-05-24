import type { ReactNode } from "react";
import { Bell, ChevronDown, FileText } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { ValidationStepper } from "./ValidationStepper";

function TorgimaMark() {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <path d="M8 20L14 6L20 20" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 16H18" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div>
        <span className="font-bold text-lg tracking-tight text-gray-900">ERECTOR</span>
        <p className="text-[10px] text-gray-500 leading-tight">Reality · Blueprint · Execution</p>
      </div>
    </div>
  );
}

export function PreLaunchShell({
  step,
  children,
}: {
  step: 1 | 2 | 3 | 4;
  children: ReactNode;
}) {
  const { data: me } = useGetMe();
  const displayName = me?.displayName ?? me?.email?.split("@")[0] ?? "Builder";

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <TorgimaMark />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <FileText className="w-4 h-4" />
            Saved Drafts
          </button>
          <button type="button" className="relative p-2 rounded-lg hover:bg-gray-50" aria-label="Notifications">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-gray-200 pl-1 pr-2 py-1 hover:bg-gray-50"
          >
            <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold flex items-center justify-center">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </header>
      <ValidationStepper current={step} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
