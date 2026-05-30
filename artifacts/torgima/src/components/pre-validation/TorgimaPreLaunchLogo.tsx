export function TorgimaPreLaunchLogo() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B21FF] to-[#6D28D9] shadow-sm"
        aria-hidden
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3L4 20h4l1.5-4h5L16 20h4L12 3z"
            fill="white"
            fillOpacity="0.95"
          />
          <path d="M10.5 14L12 9l1.5 5h-3z" fill="#C4B5FD" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-lg font-bold tracking-tight text-[#0B1220]">TORGIMA</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
          Execution System
        </p>
      </div>
    </div>
  );
}
