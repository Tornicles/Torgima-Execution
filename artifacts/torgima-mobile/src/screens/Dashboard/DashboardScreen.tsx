import { useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, RefreshControl, ScrollView } from "react-native";
import { useTaskStore } from "../../store/taskStore";
import { useSyncStore } from "../../store/syncStore";
import { StreakDisplay } from "../../components/StreakDisplay";
import { AvatarDisplay } from "../../components/AvatarDisplay";
import { updateAppBadge } from "../../services/notificationService";

export function DashboardScreen() {
  const { widget, loading, loadDashboard } = useTaskStore();
  const { hasUnsynced, unsyncedCount, isSyncing } = useSyncStore();

  const refresh = useCallback(() => {
    void loadDashboard().then(() => {
      if (widget?.badgeCount != null) void updateAppBadge(widget.badgeCount);
    });
  }, [loadDashboard, widget?.badgeCount]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <Text style={styles.title}>Today</Text>
      {hasUnsynced ? (
        <Text style={styles.syncBanner}>
          {isSyncing ? "Syncing…" : `${unsyncedCount} change(s) waiting to sync`}
        </Text>
      ) : null}

      <View style={styles.hero}>
        <AvatarDisplay level={widget?.userLevel ?? 1} xp={widget?.userXP ?? 0} />
        <View style={styles.heroText}>
          <Text style={styles.taskLabel}>Active order</Text>
          <Text style={styles.taskTitle}>
            {widget?.todayTask?.title ?? "No active order — check blueprint"}
          </Text>
          {widget?.todayTask?.dueTime ? (
            <Text style={styles.meta}>Due {widget.todayTask.dueTime}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.streakRow}>
        <StreakDisplay type="execution" count={widget?.currentStreak.execution ?? 0} />
        <StreakDisplay type="principles" count={widget?.currentStreak.principles ?? 0} />
        <StreakDisplay type="content" count={widget?.currentStreak.content ?? 0} />
      </View>

      {widget?.todayPrinciple ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Today's principle</Text>
          <Text style={styles.cardBody}>{widget.todayPrinciple.title}</Text>
        </View>
      ) : null}

      <Pressable style={styles.refreshBtn} onPress={refresh}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 20, paddingTop: 56 },
  title: { fontSize: 28, fontWeight: "800", color: "#111827", marginBottom: 8 },
  syncBanner: { fontSize: 12, color: "#b45309", marginBottom: 12 },
  hero: {
    flexDirection: "row",
    gap: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ede9fe",
  },
  heroText: { flex: 1 },
  taskLabel: { fontSize: 10, fontWeight: "700", color: "#7c3aed", textTransform: "uppercase" },
  taskTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginTop: 4 },
  meta: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  streakRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  cardLabel: { fontSize: 10, fontWeight: "700", color: "#6b7280", textTransform: "uppercase" },
  cardBody: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  refreshBtn: { alignItems: "center", padding: 12 },
  refreshText: { color: "#5b21b6", fontWeight: "600" },
});
