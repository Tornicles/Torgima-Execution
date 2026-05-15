/** Renders server-derived operational lines (no placeholder copy). */

export function OperationalAwarenessStrip(props: {
  awareness?: string[];
  signalBridge?: Array<{ headline?: string; cite?: string }>;
  executionIdentity?: string[];
  className?: string;
}) {
  const { awareness = [], signalBridge = [], executionIdentity = [], className = "" } = props;
  const hasContent =
    awareness.length > 0 || signalBridge.length > 0 || executionIdentity.length > 0;

  if (!hasContent) return null;

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-slate-950 text-slate-100 overflow-hidden ${className}`}
      aria-label="Operational awareness"
    >
      <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" aria-hidden />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
          Reality-linked awareness
        </span>
      </div>
      <div className="p-4 space-y-5 text-sm leading-relaxed">
        {awareness.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-500 mb-2">Execution posture</p>
            <ul className="space-y-2 list-disc pl-5 text-slate-200">
              {awareness.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {signalBridge.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-500 mb-2">Signal → blueprint trace</p>
            <ul className="space-y-3">
              {signalBridge.map((line) => (
                <li key={`${line.headline}-${line.cite}`} className="border-l-2 border-emerald-500/50 pl-3">
                  <p className="font-medium text-white">{line.headline}</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">{line.cite}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {executionIdentity.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase text-slate-500 mb-2">Execution identity (observed)</p>
            <ul className="space-y-2 list-disc pl-5 text-slate-300">
              {executionIdentity.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
