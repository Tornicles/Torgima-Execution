import { useState, type ReactNode } from "react";

const SOURCE_STYLES: Record<string, string> = {
  EIS: "bg-blue-50 text-blue-600",
  SIS: "bg-purple-50 text-purple-600",
  PIS: "bg-teal-50 text-teal-600",
  VERDICTENGINE: "bg-gray-100 text-gray-600",
  VerdictEngine: "bg-gray-100 text-gray-600",
};

export function IntelCard({
  title,
  source,
  defaultOpen = true,
  children,
}: {
  title: string;
  source: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tagClass = SOURCE_STYLES[source] ?? SOURCE_STYLES.EIS;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-900">{title}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${tagClass}`}>
            {source}
          </span>
        </div>
        <span className="text-gray-400 text-sm">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-100">{children}</div>}
    </div>
  );
}

export function IntelField({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">{label}</p>
      <div className="text-sm text-gray-800">{value}</div>
    </div>
  );
}
