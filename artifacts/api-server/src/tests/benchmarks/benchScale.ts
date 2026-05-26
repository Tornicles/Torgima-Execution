/** Scale benchmark iteration counts: full suite when RUN_BHUDHI_BENCHMARKS=true, else CI-fast. */
export function benchScale(full: number, ci = Math.max(10, Math.floor(full / 20))): number {
  return process.env.RUN_BHUDHI_BENCHMARKS === "true" ? full : ci;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? 0;
}
