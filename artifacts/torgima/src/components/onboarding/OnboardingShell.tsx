import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  FileText,
  FolderKanban,
  LayoutGrid,
  Map,
  Menu,
  PlusCircle,
  Settings,
  Shield,
} from "lucide-react";

const NAV = [
  { href: "/onboarding", label: "New Validation", icon: PlusCircle, match: "/onboarding" },
  { href: "/validation", label: "Validations", icon: FileText, match: "/validation" },
  { href: "/blueprint", label: "Blueprints", icon: Map, match: "/blueprint" },
  { href: "/dashboard", label: "Projects", icon: FolderKanban, match: "/dashboard" },
  { href: "/analytics", label: "Reports", icon: BarChart3, match: "/analytics" },
  { href: "/signals", label: "Signals", icon: LayoutGrid, match: "/signals" },
  { href: "/settings", label: "Settings", icon: Settings, match: "/settings" },
] as const;

export function OnboardingShell({
  children,
  topRight,
}: {
  children: ReactNode;
  topRight?: ReactNode;
}) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-[200px] shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-5 border-b border-gray-100">
          <p className="text-xs font-bold tracking-widest text-violet-700">ERECTOR</p>
          <p className="text-sm font-bold text-gray-900">TORGIMA</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((item) => {
            const active =
              location === item.href ||
              (item.match === "/onboarding" && location.startsWith("/onboarding")) ||
              (item.match !== "/onboarding" && location.startsWith(item.match));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                    active ? "bg-violet-100 text-violet-800 font-semibold" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 space-y-3 border-t border-gray-100">
          <div className="rounded-lg bg-violet-50 border border-violet-100 p-3 text-xs text-gray-700">
            <p className="font-semibold text-gray-900">Need help?</p>
            <p className="mt-1 text-gray-600">Learn how validation works and what happens next.</p>
            <button type="button" className="mt-2 text-violet-700 font-semibold hover:underline">
              View Guide →
            </button>
          </div>
          <div className="flex items-start gap-2 text-[11px] text-gray-500">
            <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Your data is private and secure. We never share your information.</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
          <button type="button" className="p-2 text-gray-500 hover:text-gray-800" aria-label="Menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            {topRight ?? (
              <>
                <button
                  type="button"
                  className="text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                >
                  Saved Drafts
                </button>
                <div className="w-8 h-8 rounded-full bg-violet-200" aria-hidden />
              </>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
