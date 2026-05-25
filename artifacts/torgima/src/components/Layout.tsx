import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Map,
  ClipboardList,
  MessageSquare,
  Activity,
  Target,
  RefreshCw,
  User,
  BookOpen,
  FileText,
  Settings,
  ChevronRight,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { sidebarMotivation } from "@/design";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/blueprint", label: "Blueprint", icon: Map },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/signals", label: "Signals", icon: Activity },
  { href: "/strategy", label: "Strategy", icon: Target },
  { href: "/recovery", label: "Recovery", icon: RefreshCw },
  { href: "/character", label: "Character", icon: User },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/reports", label: "Reports", icon: FileText },
];

const NAV_SECONDARY = [{ href: "/settings", label: "Settings", icon: Settings }];

function TorgimaLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
        <path d="M12 4L6 8V16L12 20L18 16V8L12 4Z" stroke="#1a8c3a" strokeWidth="2" fill="none" />
        <path d="M9 11L12 9L15 11" stroke="#1a8c3a" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 9V15" stroke="#1a8c3a" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div>
        <span className="font-bold text-sm tracking-tight text-gray-900">TORGIMA</span>
        <p className="text-[9px] text-gray-400 leading-tight">Reality · Blueprint · Execution</p>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  location,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  location: string;
  onNavigate?: () => void;
}) {
  const isActive = location === href || (href !== "/dashboard" && location.startsWith(href));
  return (
    <Link href={href}>
      <div
        onClick={onNavigate}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-r-lg cursor-pointer transition-all text-sm border-l-[3px] ${
          isActive
            ? "bg-[var(--torgima-primary-light)] text-[var(--torgima-primary)] font-semibold border-[var(--torgima-primary)]"
            : "text-gray-600 border-transparent hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[var(--torgima-primary)]" : "text-gray-400"}`} />
        {label}
      </div>
    </Link>
  );
}

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: me } = useGetMe();
  const displayName = me?.displayName ?? me?.email?.split("@")[0] ?? "Builder";
  const tier = me?.tier ?? "Premium";

  const motivationKey = Object.keys(sidebarMotivation).find((p) => p !== "default" && location.startsWith(p));
  const motivation = sidebarMotivation[motivationKey ?? "default"] ?? sidebarMotivation.default;

  const sidebar = (
    <>
      <div className="px-4 py-4 border-b border-gray-100">
        <TorgimaLogo />
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} location={location} onNavigate={() => setMobileOpen(false)} />
        ))}
        <div className="pt-3 mt-2 border-t border-gray-100">
          {NAV_SECONDARY.map((item) => (
            <NavLink key={item.href} {...item} location={location} onNavigate={() => setMobileOpen(false)} />
          ))}
        </div>
      </nav>

      <div className="px-3 py-3 mx-2 mb-2 rounded-lg border border-[var(--torgima-primary-light)] bg-[var(--torgima-primary-light)]">
        <div className="flex gap-2">
          <Shield className="w-4 h-4 text-[var(--torgima-primary)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-gray-800 leading-snug">{motivation.title}</p>
            <p className="text-[10px] text-[var(--torgima-primary)] italic mt-1 leading-snug">{motivation.body}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 px-3 py-3">
        <Link href="/settings">
          <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg p-2 -mx-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">{displayName.charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                <p className="text-[10px] text-[var(--torgima-primary)] font-medium capitalize">{tier} Plan</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </div>
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <aside className="hidden lg:flex w-[200px] shrink-0 flex-col border-r border-gray-200 bg-white">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-[200px] max-w-[85vw] h-full flex flex-col bg-white shadow-xl">
            <button
              type="button"
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileOpen(false)}
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <TorgimaLogo />
        </div>
        <main className="flex-1 overflow-y-auto bg-white">{children}</main>
      </div>
    </div>
  );
}
