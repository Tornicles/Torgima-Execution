import type { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronLeft, Sparkles } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/bhudhi", label: "Bhudhi" },
  { href: "/erector", label: "Erector", active: true },
  { href: "/signals", label: "Signals" },
  { href: "/onboarding", label: "Validate" },
];

export function ErectorFlowShell({
  children,
  backHref = "/erector",
  backLabel = "Back to Erector",
  title,
  subtitle,
}: {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen flex bg-[#0f172a] text-slate-100">
      <aside className="w-56 shrink-0 border-r border-slate-800 bg-[#0b1220] flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <div>
              <p className="text-xs font-bold tracking-wide text-white">TORGIMA</p>
              <p className="text-[10px] text-slate-500">Execution System</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm ${
                item.active
                  ? "bg-violet-600/20 text-violet-300 font-medium"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 m-2 rounded-xl bg-slate-900/80 border border-slate-700">
          <p className="text-[10px] text-violet-300 font-semibold">Erector</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Reality & Preparation Layer</p>
          <span className="inline-flex items-center gap-1 mt-2 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Active
          </span>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-800 bg-[#0f172a]/90 px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 mb-1">
              <ChevronLeft className="w-4 h-4" />
              {backLabel}
            </Link>
            {title ? <h1 className="text-xl font-bold text-white">{title}</h1> : null}
            {subtitle ? <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p> : null}
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-[#111827]">{children}</main>
      </div>
    </div>
  );
}
