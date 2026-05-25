import { useMemo } from "react";

export function TrendChart({
  points,
  labels,
  height = 160,
}: {
  points: number[];
  labels?: string[];
  height?: number;
}) {
  const path = useMemo(() => {
    if (points.length === 0) return "";
    const w = 700;
    const h = height - 20;
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = max - min || 1;
    const step = w / Math.max(points.length - 1, 1);
    const coords = points.map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * (h - 10) - 10;
      return [x, y] as const;
    });
    const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x},${y}`).join(" ");
    const area = `${line} L ${w},${h} L 0,${h} Z`;
    return { line, area, coords };
  }, [points, height]);

  if (!path || points.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No trend data yet
      </div>
    );
  }

  return (
    <div>
      <svg className="w-full" viewBox={`0 0 700 ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a8c3a" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1a8c3a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={path.area} fill="url(#trendFill)" />
        <path d={path.line} fill="none" stroke="#1a8c3a" strokeWidth="2.5" strokeLinecap="round" />
        {path.coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4" fill="white" stroke="#1a8c3a" strokeWidth="2" />
        ))}
      </svg>
      {labels && labels.length > 0 && (
        <div className="flex justify-between mt-2">
          {labels.map((d) => (
            <span key={d} className="text-xs text-gray-400">
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
