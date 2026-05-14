import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Map,
  ClipboardList,
  MessageSquare,
  Activity,
  Compass,
  RefreshCw,
  User,
  BookOpen,
  Settings,
  ChevronRight,
  Bell,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/blueprint", label: "Blueprint", icon: Map },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/signals", label: "Signals", icon: Activity },
  { href: "/strategy", label: "Strategy", icon: Compass },
  { href: "/recovery", label: "Recovery", icon: RefreshCw },
  { href: "/character", label: "Character", icon: User },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface LayoutProps {
  children: ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  headerRight?: ReactNode;
  user?: { displayName?: string | null; email?: string | null; tier?: string | null } | null;
}

export function Layout({ children, pageTitle, pageSubtitle, headerRight, user: userProp }: LayoutProps) {
  const [location] = useLocation();
  const { data: me } = useGetMe();
  const user = userProp ?? me ?? null;

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "Builder";
  const tier = user?.tier ?? "Starter";

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-1">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
              <path d="M14 4L4 10V18L14 24L24 18V10L14 4Z" stroke="#111827" strokeWidth="2" fill="none" />
              <path d="M9 13L14 10L19 13" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
              <path d="M14 10V19" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="font-bold text-lg tracking-tight text-gray-900">TORGIMA</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm ${
                    isActive
                      ? "bg-green-50 text-green-700 font-semibold border-l-2 border-green-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-green-600" : "text-gray-400"}`} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 mx-3 mb-3 bg-green-50 rounded-xl border border-green-100">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
            <p className="text-xs font-semibold text-green-800">Stay Consistent.</p>
          </div>
          <p className="text-xs font-semibold text-green-800">Build Reality.</p>
          <p className="text-xs text-green-600 mt-1">The system works when you execute.</p>
        </div>

        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg p-1 -mx-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{displayName.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                <p className="text-xs text-green-600 font-medium capitalize">{tier} Plan</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {(pageTitle || headerRight) && (
          <header className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-white">
            <div>
              {pageTitle && <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>}
              {pageSubtitle && <p className="text-sm text-gray-500 mt-0.5">{pageSubtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
              {headerRight}
              <button
                type="button"
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center cursor-pointer">
                <span className="text-white text-sm font-bold">{displayName.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
