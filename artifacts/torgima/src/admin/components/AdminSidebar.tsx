import { Link, useLocation } from "wouter";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/health", label: "System Health" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/bhudhi", label: "Bhudhi Usage" },
  { href: "/admin/dead-letter", label: "Dead Letter Queue" },
  { href: "/admin/audit", label: "Audit Log" },
] as const;

export function AdminSidebar({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [path] = useLocation();

  return (
    <aside className="w-56 shrink-0 border-r border-slate-800 bg-[#070B14] p-4 flex flex-col min-h-screen">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-violet-400 font-semibold">Torgima</p>
        <h1 className="text-lg font-bold text-white">Super Admin</h1>
        <p className="text-xs text-slate-500 mt-1 truncate">{email}</p>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-violet-600/20 text-violet-200"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={onLogout}
        className="mt-4 text-left text-sm text-slate-500 hover:text-red-400"
      >
        Sign out
      </button>
    </aside>
  );
}
