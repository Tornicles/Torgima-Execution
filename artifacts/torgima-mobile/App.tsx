import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useAuthStore } from "./src/store/authStore";
import { syncEngine } from "./src/services/syncService";
import { registerForPushNotifications } from "./src/services/notificationService";
import { initOfflineDatabase } from "./src/utils/offlineQueue";

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    void hydrate();
    void initOfflineDatabase();
  }, [hydrate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncEngine.start();
    void registerForPushNotifications();
    return () => syncEngine.stop();
  }, [isAuthenticated]);

  return (
    <>
      <RootNavigator />
      <StatusBar style="dark" />
    </>
  );
}
