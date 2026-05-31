import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Map,
  MessageSquare,
  Activity,
  Settings,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  Sparkles,
  Lock,
  Brain,
  Zap,
  Users,
  GraduationCap,
  BookOpen,
  RefreshCw,
  Target,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { apiGet } from "@/lib/torgima-api";
import type { FeatureStatusPayload } from "@/lib/feature-gate";
import { LANGUAGE } from "@/lib/language";
import { PageBackground } from "@workspace/design-system";
import { DESIGN_TOKENS } from "@workspace/design-system/tokens";

const NAV_ITEMS = [
  { href: "/dashboard", label: LANGUAGE.nav.home, icon: LayoutDashboard },
  { href: "/app/bhudhi", label: LANGUAGE.nav.bhudhi, icon: Sparkles },
  { href: "/erector", label: LANGUAGE.nav.erector, icon: Zap },
  { href: "/signals", label: LANGUAGE.nav.progress, icon: Activity },
  { href: "/blueprint", label: LANGUAGE.nav.project, icon: Map },
  { href: "/feedback", label: LANGUAGE.nav.messages, icon: MessageSquare },
  { href: "/character", label: LANGUAGE.nav.community, icon: Users },
  { href: "/knowledge", label: LANGUAGE.nav.academy, icon: GraduationCap },
];

const NAV_SECONDARY = [{ href: "/settings", label: LANGUAGE.nav.settings, icon: Settings }];

const MOBILE_NAV = [
  { href: "/dashboard", label: LANGUAGE.nav.home, icon: LayoutDashboard },
  { href: "/orders", label: LANGUAGE.nav.tasks, icon: Map },
  { href: "/signals", label: LANGUAGE.nav.progress, icon: Activity },
  { href: "/app/bhudhi", label: LANGUAGE.nav.bhudhi, icon: Sparkles },
  { href: "/settings", label: LANGUAGE.nav.settings, icon: Settings },
];

const HOME_PURPLE = DESIGN_TOKENS.colors.primaryBright;

function TorgimaLogo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden className="shrink-0">
        <path d="M14 3L5 8.5V19.5L14 25L23 19.5V8.5L14 3Z" fill={HOME_PURPLE} fillOpacity="0.12" stroke={HOME_PURPLE} strokeWidth="1.5" />
        <text x="14" y="17" textAnchor="middle" fill={HOME_PURPLE} fontSize="11" fontWeight="bold">
          T
        </text>
      </svg>
      {!compact && (
        <div>
          <span className="font-bold text-xs tracking-tight text-foreground leading-tight block font-heading">
            TORGIMA
          </span>
          <p className="text-[8px] text-muted-foreground leading-tight uppercase tracking-wide">
            Execution System
          </p>
        </div>
      )}
    </div>
  );
}

function DotMeter({ filled, total, color }: { filled: number; total: number; color: string }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: i < filled ? color : "#E2E8F0" }}
        />
      ))}
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  location,
  onNavigate,
  locked,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  location: string;
  onNavigate?: () => void;
  locked?: boolean;
}) {
  const isActive = location === href || (href !== "/dashboard" && location.startsWith(href));
  return (
    <Link href={href}>
      <div
        onClick={onNavigate}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-r-lg cursor-pointer transition-all text-sm border-l-[3px] ${
          isActive
            ? "font-semibold border-primary-bright bg-primary/15 text-primary-bright"
            : "text-muted-foreground border-transparent hover:bg-dark-hover hover:text-foreground"
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary-bright" : "text-muted-foreground"}`} />
        <span className="flex-1 truncate">{label}</span>
        {locked && <Lock className="w-3 h-3 text-gray-400 shrink-0" />}
      </div>
    </Link>
  );
}

interface LayoutProps {
  children: ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
}

const TIER_NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  "/growth": Brain,
  "/growth/knowledge": BookOpen,
  "/growth/interrogation": MessageSquare,
  "/growth/adaptation": RefreshCw,
  "/growth/patterns": Activity,
  "/ultimate": Zap,
  "/ultimate/predictions": Target,
  "/ultimate/scene": Sparkles,
};

type CharacterSidebar = {
  executionIntelligence?: number;
  consistency?: number;
  characterLevel?: number;
};

export function Layout({ children, pageTitle, pageSubtitle }: LayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [featureStatus, setFeatureStatus] = useState<FeatureStatusPayload | null>(null);
  const [character, setCharacter] = useState<CharacterSidebar | null>(null);
  const { data: me } = useGetMe();
  const displayName = me?.displayName ?? me?.email?.split("@")[0] ?? "Builder";
  const tier = me?.tier ?? "Premium";
  const level = character?.characterLevel ?? 7;
  const execDots = Math.min(12, Math.round((character?.executionIntelligence ?? 0.65) * 12));
  const consistencyDots = Math.min(12, Math.round((character?.consistency ?? 0.58) * 12));

  useEffect(() => {
    void apiGet<FeatureStatusPayload>("/api/v1/features/status")
      .then(setFeatureStatus)
      .catch(() => setFeatureStatus(null));
    void apiGet<{ character?: CharacterSidebar }>("/api/character/current")
      .then((r) => setCharacter(r.character ?? null))
      .catch(() => setCharacter(null));
  }, [location]);

  const sidebar = (
    <>
      <div className="px-4 py-4 border-b border-dark-border">
        <TorgimaLogo />
        {featureStatus?.sequenceStatus && (
          <p className="text-[10px] text-gray-500 mt-2">
            {featureStatus.sequenceStatus.tier} · Seq{" "}
            {featureStatus.sequenceStatus.currentSequence}/
            {featureStatus.sequenceStatus.totalSequences}
          </p>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} location={location} onNavigate={() => setMobileOpen(false)} />
        ))}
        {featureStatus?.navigation
          ?.filter(
            (n: FeatureStatusPayload["navigation"][number]) =>
              (n.group === "growth" || n.group === "ultimate") && !n.locked,
          )
          .map((item: FeatureStatusPayload["navigation"][number]) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={TIER_NAV_ICONS[item.href] ?? Sparkles}
              location={location}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        <div className="pt-3 mt-2 border-t border-dark-border">
          {NAV_SECONDARY.map((item) => (
            <NavLink key={item.href} {...item} location={location} onNavigate={() => setMobileOpen(false)} />
          ))}
        </div>
      </nav>

      {!sidebarCollapsed && (
        location.startsWith("/app/bhudhi") || location === "/bhudhi" ? (
          <div className="mx-2 mb-2 rounded-xl border border-violet-200 bg-[#F5F3FF] p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 shrink-0" style={{ color: HOME_PURPLE }} />
              <div>
                <p className="text-sm font-bold text-gray-900">Bhudhi</p>
                <p className="text-[10px] text-gray-500">Your intelligence layer</p>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </p>
            <p className="text-[10px] text-[#64748B] mt-2 italic leading-snug">
              Bhudhi explains. You decide. You execute.
            </p>
          </div>
        ) : location === "/erector" ? (
          <div className="mx-2 mb-2 rounded-xl border border-violet-200 bg-[#F5F3FF] p-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 shrink-0" style={{ color: HOME_PURPLE }} />
              <div>
                <p className="text-sm font-bold text-gray-900">Erector</p>
                <p className="text-[10px] text-gray-500">Reality & Preparation Layer</p>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </p>
            <p className="text-[10px] text-[#64748B] mt-2 italic leading-snug">
              We validate. We simulate. We prepare.
            </p>
          </div>
        ) : (
          <div className="mx-2 mb-2 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: HOME_PURPLE }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-gray-500">Level {level}</p>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: HOME_PURPLE }}
                  >
                    Pro
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-[9px] font-semibold text-gray-500 uppercase mb-1">Execution Intelligence</p>
                <DotMeter filled={execDots} total={12} color={HOME_PURPLE} />
              </div>
              <div>
                <p className="text-[9px] font-semibold text-gray-500 uppercase mb-1">Consistency</p>
                <DotMeter filled={consistencyDots} total={12} color="#22C55E" />
              </div>
            </div>
          </div>
        )
      )}

      <button
        type="button"
        onClick={() => setSidebarCollapsed((c) => !c)}
        className="mx-3 mb-3 flex items-center gap-2 text-[10px] text-gray-500 hover:text-gray-800 py-2 border-t border-gray-100 w-[calc(100%-1.5rem)]"
      >
        <ChevronLeft className={`w-3.5 h-3.5 transition ${sidebarCollapsed ? "rotate-180" : ""}`} />
        {sidebarCollapsed ? "Expand" : "Collapse"}
      </button>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-dark relative">
      <PageBackground />
      <aside
        className={`hidden lg:flex shrink-0 flex-col border-r border-dark-border bg-dark-card transition-all ${
          sidebarCollapsed ? "w-[72px]" : "w-[220px]"
        }`}
      >
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
          <aside className="relative w-[200px] max-w-[85vw] h-full flex flex-col bg-dark-card shadow-xl border-r border-dark-border">
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
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-dark-border bg-dark-card shrink-0">
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
        <main className="flex-1 overflow-y-auto bg-dark pb-20 lg:pb-0 relative">
          {(pageTitle || pageSubtitle) && (
            <div className="px-6 pt-4 hidden">
              {pageTitle && <h1 className="text-lg font-bold">{pageTitle}</h1>}
              {pageSubtitle && <p className="text-sm text-gray-500">{pageSubtitle}</p>}
            </div>
          )}
          {children}
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-dark-border bg-dark-card flex justify-around py-2 safe-area-pb">
          {MOBILE_NAV.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/dashboard" && location.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px] ${
                    isActive ? "text-primary-bright" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
