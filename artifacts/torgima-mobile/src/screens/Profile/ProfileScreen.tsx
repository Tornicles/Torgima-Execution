import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAuthStore } from "../../store/authStore";
import { useTaskStore } from "../../store/taskStore";
import { useSyncStore } from "../../store/syncStore";
import { syncEngine } from "../../services/syncService";
import { syncHealthData } from "../../services/healthService";

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const widget = useTaskStore((s) => s.widget);
  const { hasUnsynced, unsyncedCount, lastSuccessfulSync } = useSyncStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.meta}>
        Level {widget?.userLevel ?? 1} · {widget?.userXP?.toLocaleString() ?? 0} XP
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync</Text>
        <Text style={styles.cardBody}>
          {hasUnsynced ? `${unsyncedCount} pending` : "All changes synced"}
        </Text>
        {lastSuccessfulSync ? (
          <Text style={styles.cardMeta}>Last sync {new Date(lastSuccessfulSync).toLocaleString()}</Text>
        ) : null}
        <Pressable style={styles.btnOutline} onPress={() => void syncEngine.syncPendingActions()}>
          <Text style={styles.btnOutlineText}>Sync now</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wearables (stub)</Text>
        <Text style={styles.cardBody}>Apple Health / Google Fit sync placeholder</Text>
        <Pressable
          style={styles.btnOutline}
          onPress={() =>
            void syncHealthData({ steps: 8000, activeMinutes: 45, source: "apple-health" })
          }
        >
          <Text style={styles.btnOutlineText}>Send sample health data</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logout} onPress={() => void logout()}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 56, backgroundColor: "#f9fafb" },
  title: { fontSize: 28, fontWeight: "800" },
  email: { fontSize: 16, color: "#374151", marginTop: 4 },
  meta: { fontSize: 14, color: "#6b7280", marginBottom: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  cardTitle: { fontWeight: "700", fontSize: 15 },
  cardBody: { color: "#4b5563", marginTop: 4, fontSize: 14 },
  cardMeta: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  btnOutline: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#5b21b6",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  btnOutlineText: { color: "#5b21b6", fontWeight: "600" },
  logout: { marginTop: 32, alignItems: "center" },
  logoutText: { color: "#dc2626", fontWeight: "600" },
});
