import { useEffect, useState } from "react";

/**
 * DOC 37 — offline indicator + window focus signal for projection refetch (two tabs).
 */
export function useNetworkResilience(onRefocus?: () => void) {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onFocus = () => onRefocus?.();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
    };
  }, [onRefocus]);

  return { online };
}
