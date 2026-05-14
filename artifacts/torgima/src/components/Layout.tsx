import { Link, useLocation } from "wouter";
import type { ComponentType, ReactNode } from "react";
import {
  TerminalSquare,
  LayoutDashboard,
  Activity,
  CheckSquare,
  MessageSquare,
  Settings,
  Target,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: me } = useGetMe();

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col justify-between shrink-0">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-border">
            <Link href="/dashboard">
              <div className="flex items-center gap-3 cursor-pointer text-primary font-mono tracking-tight font-bold text-lg hover:text-primary/80 transition-colors">
                <TerminalSquare className="h-5 w-5" />
                <span>TORGIMA_OS</span>
              </div>
            </Link>
          </div>

          <nav className="p-4 space-y-1 mt-4">
            <NavItem
              href="/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              active={location === "/dashboard"}
            />
            <NavItem href="/signals" icon={Activity} label="Signals" active={location === "/signals"} />
            <NavItem
              href="/tasks/current"
              icon={CheckSquare}
              label="Active Task"
              active={location.startsWith("/tasks")}
            />
            <NavItem href="/feedback" icon={MessageSquare} label="Feedback" active={location.startsWith("/feedback")} />
            <NavItem href="/identity" icon={Target} label="Identity" active={location === "/identity"} />
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <NavItem href="/settings" icon={Settings} label="Settings" active={location === "/settings"} />
          <div className="mt-4 px-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-secondary border border-border flex items-center justify-center text-xs font-mono font-bold">
              {(me?.displayName ?? me?.email ?? "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold truncate max-w-[120px]">
                {me?.displayName ?? me?.email ?? "Operator"}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">ID: {me?.id?.slice(0, 6) || "---"}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-background relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMDAwIi8+PC9zdmc+')] mix-blend-overlay z-50" />
        {children}
      </main>
    </div>
  );
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: ComponentType<{ className?: string }>; label: string; active: boolean }) {
  return (
    <Link href={href}>
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-sm cursor-pointer transition-colors text-sm font-medium ${
          active
            ? "bg-primary/10 text-primary font-bold border-l-2 border-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground border-l-2 border-transparent"
        }`}
      >
        <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
        <span>{label}</span>
      </div>
    </Link>
  );
}
