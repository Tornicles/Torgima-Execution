import { api } from "./apiClient";
import { cacheWidgetData, getCachedWidgetData } from "../utils/offlineQueue";
import type { WidgetData } from "../store/taskStore";

export async function fetchWidgetData(): Promise<WidgetData | null> {
  try {
    const res = await api.get<{ widget: WidgetData }>("/mobile/widget-data");
    await cacheWidgetData(res.widget);
    return res.widget;
  } catch {
    return getCachedWidgetData<WidgetData>();
  }
}

/**
 * Native home-screen widgets (WidgetKit / AppWidget) live in ios/ and android/ folders
 * after `npx expo prebuild`. They should read from App Group / SharedPreferences
 * populated by this function on each background fetch.
 */
export async function pushWidgetSnapshotToNative(widget: WidgetData) {
  void widget;
  // Hook: expo-widget or custom native module writes shared storage for WidgetKit.
}
