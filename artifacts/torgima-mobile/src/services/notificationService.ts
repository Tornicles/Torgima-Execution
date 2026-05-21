import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "./apiClient";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  await api.post("/mobile/device-token", {
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
    appVersion: "1.0.0",
  });

  return token;
}

export async function updateAppBadge(count: number) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    /* unsupported on some platforms */
  }
}
