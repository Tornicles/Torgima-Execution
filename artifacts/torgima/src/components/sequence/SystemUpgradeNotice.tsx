import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { apiGet, apiPost } from "@/lib/torgima-api";

const NOTICE_TYPE = "system_upgrade_25_sequences";

type InAppNotification = {
  id: string;
  title: string;
  body: string;
  notification_type: string;
};

export function SystemUpgradeNotice() {
  const [notice, setNotice] = useState<InAppNotification | null>(null);

  useEffect(() => {
    void apiGet<{ notifications: InAppNotification[] }>("/api/notifications/in-app?unread=true")
      .then((res) => {
        const match = (res.notifications ?? []).find(
          (n) => n.notification_type === NOTICE_TYPE,
        );
        setNotice(match ?? null);
      })
      .catch(() => setNotice(null));
  }, []);

  if (!notice) return null;

  const dismiss = () => {
    void apiPost(`/api/notifications/in-app/${notice.id}/read`, {}).finally(() =>
      setNotice(null),
    );
  };

  return (
    <div
      className="rounded-xl border border-[var(--torgima-primary)]/30 bg-[var(--torgima-primary-light)] px-4 py-3 flex gap-3 items-start"
      role="status"
    >
      <Sparkles className="w-5 h-5 text-[var(--torgima-primary)] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{notice.title}</p>
        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{notice.body}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="p-1 rounded hover:bg-white/60 shrink-0"
        aria-label="Dismiss notice"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
}
