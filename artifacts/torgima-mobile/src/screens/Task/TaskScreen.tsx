import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { useTaskStore } from "../../store/taskStore";
import { submitTaskFeedbackOffline } from "../../services/syncService";

export function TaskScreen() {
  const { widget, summary, loadDashboard } = useTaskStore();
  const [reflection, setReflection] = useState("");

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const task = widget?.todayTask;
  const blueprintId = summary?.activeBlueprintId as string | undefined;

  async function quickComplete(status: "completed" | "partial" | "failed" | "skipped") {
    if (!task?.id || !blueprintId) {
      Alert.alert("No active task", "Activate a blueprint with an order first.");
      return;
    }
    await submitTaskFeedbackOffline({
      orderId: task.id,
      blueprintId,
      completionStatus: status,
      score: status === "completed" ? 8 : status === "partial" ? 5 : 3,
      feedbackText: reflection || undefined,
    });
    Alert.alert("Saved", "Feedback queued — syncs when online.");
    setReflection("");
    void loadDashboard();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Execute</Text>
      <Text style={styles.taskTitle}>{task?.title ?? "No active order"}</Text>

      <TextInput
        style={styles.input}
        placeholder="Optional reflection…"
        value={reflection}
        onChangeText={setReflection}
        multiline
      />

      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.done]} onPress={() => void quickComplete("completed")}>
          <Text style={styles.btnText}>Done</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.partial]} onPress={() => void quickComplete("partial")}>
          <Text style={styles.btnText}>Partial</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.fail]} onPress={() => void quickComplete("failed")}>
          <Text style={styles.btnText}>Failed</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.skip]} onPress={() => void quickComplete("skipped")}>
          <Text style={styles.btnText}>Skip</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>Quick feedback works offline and from home-screen widgets.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 56, backgroundColor: "#f9fafb" },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  taskTitle: { fontSize: 18, fontWeight: "600", marginBottom: 20, color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    backgroundColor: "#fff",
    marginBottom: 16,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  done: { backgroundColor: "#059669" },
  partial: { backgroundColor: "#d97706" },
  fail: { backgroundColor: "#dc2626" },
  skip: { backgroundColor: "#6b7280" },
  btnText: { color: "#fff", fontWeight: "700" },
  hint: { fontSize: 12, color: "#9ca3af", marginTop: 16, textAlign: "center" },
});
