import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { apiGet } from "@/lib/torgima-api";

type WidgetPayload = {
  data: {
    type: string;
    currentStreak?: number;
    level?: number;
    streak?: number;
  };
};

export default function ProfileWidgetPage() {
  const [, params] = useRoute("/widget/:widgetType/:userId");
  const widgetType = params?.widgetType ?? "streak-counter";
  const userId = params?.userId ?? "";
  const [payload, setPayload] = useState<WidgetPayload["data"] | null>(null);

  useEffect(() => {
    if (!userId) return;
    void apiGet<{ data: WidgetPayload["data"] }>(`/api/profiles/${userId}/widgets/${widgetType}`)
      .then((res) => setPayload(res?.data ?? null))
      .catch(() => setPayload(null));
  }, [userId, widgetType]);

  if (!payload) {
    return (
      <div className="min-h-[80px] flex items-center justify-center bg-white text-gray-500 text-sm">
        TORGIMA
      </div>
    );
  }

  if (widgetType === "level-badge") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[120px] bg-white rounded-lg border border-gray-200 p-4">
        <div className="w-16 h-16 rounded-full bg-green-600 text-white flex items-center justify-center text-2xl font-bold">
          {payload.level ?? 1}
        </div>
        <span className="text-xs uppercase tracking-wide text-gray-500 mt-2">Level</span>
      </div>
    );
  }

  if (widgetType === "accountability-card") {
    return (
      <div className="min-h-[120px] bg-white rounded-lg border border-gray-200 p-4 space-y-2">
        <p className="text-xs uppercase text-gray-500">Accountability</p>
        <p className="text-lg font-semibold">Level {payload.level ?? 1}</p>
        <p className="text-sm text-gray-600">🔥 {payload.streak ?? payload.currentStreak ?? 0} day streak</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 min-h-[80px] bg-white rounded-lg border border-gray-200 px-4 py-3">
      <span className="text-2xl">🔥</span>
      <div>
        <p className="text-xs uppercase text-gray-500">Streak</p>
        <p className="text-xl font-semibold text-gray-900">
          {payload.currentStreak ?? payload.streak ?? 0} days
        </p>
      </div>
    </div>
  );
}
