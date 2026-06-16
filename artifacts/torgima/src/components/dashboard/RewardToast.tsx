import { useEffect, useState } from "react";
import type { RewardSnapshot } from "@/types/dashboard";

/** DOC 33 — brief reinforcement toast from projection reward snapshot. */
export function RewardToast({ reward }: { reward?: RewardSnapshot }) {
  const [visible, setVisible] = useState(Boolean(reward));

  useEffect(() => {
    if (!reward) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 8000);
    return () => window.clearTimeout(timer);
  }, [reward]);

  if (!reward || !visible) return null;

  return (
    <div
      role="status"
      className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 shadow-sm"
    >
      <p className="font-semibold">{reward.label ?? "Momentum boost"}</p>
      {reward.message ? <p className="mt-0.5 text-xs text-violet-800">{reward.message}</p> : null}
    </div>
  );
}
