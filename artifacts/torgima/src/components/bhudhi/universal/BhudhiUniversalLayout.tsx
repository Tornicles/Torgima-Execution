import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { bhudhiPath } from "@/hooks/useBhudhiBlueprint";

const NAV_ITEMS = [
  { section: "", icon: "○", label: "Overview" },
  { section: "execution", icon: "▶", label: "Execution" },
  { section: "intelligence", icon: "◆", label: "Intelligence" },
  { section: "governance", icon: "◈", label: "Governance" },
  { section: "memory", icon: "◇", label: "Memory" },
  { section: "protocol", icon: "□", label: "Protocol" },
  { section: "systems", icon: "⬢", label: "Systems" },
  { section: "monitoring", icon: "◉", label: "Monitoring" },
  { section: "convergence", icon: "↔", label: "Convergence" },
  { section: "certification", icon: "✓", label: "Certification" },
  { section: "launch", icon: "🚀", label: "Launch" },
  { section: "civilization", icon: "🌐", label: "Civilization" },
  { section: "expansion", icon: "⬡", label: "Expansion" },
  { section: "settings", icon: "⚙", label: "Settings" },
] as const;

function NavLink({
  href,
  icon,
  label,
  open,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  open: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition text-sm ${
        active ? "bg-gray-200 text-gray-900 font-medium" : "text-gray-700 hover:bg-gray-200"
      }`}
    >
      <span className="text-lg w-6 text-center">{icon}</span>
      {open && <span>{label}</span>}
    </Link>
  );
}

export function BhudhiUniversalLayout({
  children,
  blueprintId,
  section,
}: {
  children: ReactNode;
  blueprintId: string;
  section: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-white">
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } shrink-0 bg-gray-50 border-r border-gray-200 transition-all duration-200 flex flex-col`}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between gap-2">
            {sidebarOpen && <h1 className="text-2xl font-light tracking-tight">BHUDHI</h1>}
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-500 hover:text-gray-700 text-sm"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? "←" : "→"}
            </button>
          </div>
          {sidebarOpen && blueprintId && (
            <p className="text-xs text-gray-500 mt-2 font-mono truncate">{blueprintId.slice(0, 8)}…</p>
          )}
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.section || "overview"}
              href={bhudhiPath(item.section, blueprintId)}
              icon={item.icon}
              label={item.label}
              open={sidebarOpen}
              active={section === item.section}
            />
          ))}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
            <Link href="/dashboard" className="hover:underline">
              ← Main dashboard
            </Link>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 sm:p-8 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/** Parse current Bhudhi section from location path. */
export function parseBhudhiSection(location: string): string {
  const path = location.split("?")[0];
  const appMatch = path.match(/^\/app\/bhudhi\/?([^/]*)/);
  if (appMatch) {
    const seg = appMatch[1] ?? "";
    return seg === "kernel" ? "execution" : seg;
  }
  const legacyMatch = path.match(/^\/bhudhi\/?([^/]*)/);
  if (legacyMatch) {
    const seg = legacyMatch[1] ?? "";
    const unified = [
      "",
      "execution",
      "intelligence",
      "governance",
      "memory",
      "protocol",
      "systems",
      "monitoring",
      "convergence",
      "certification",
      "launch",
      "civilization",
      "expansion",
      "settings",
      "kernel",
    ];
    if (unified.includes(seg)) return seg === "kernel" ? "execution" : seg;
  }
  return "";
}
