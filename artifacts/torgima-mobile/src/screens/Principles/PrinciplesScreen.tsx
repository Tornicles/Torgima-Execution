import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { api } from "../../services/apiClient";
import { useTaskStore } from "../../store/taskStore";

export function PrinciplesScreen() {
  const { widget } = useTaskStore();
  const [today, setToday] = useState<{ application?: { application_description?: string } } | null>(
    null,
  );

  useEffect(() => {
    void api
      .get<{ application: { application_description?: string } | null }>(
        "/principle-applications/today",
      )
      .then((r) => setToday({ application: r.application ?? undefined }))
      .catch(() => null);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Principles</Text>
      <Text style={styles.streak}>Streak: {widget?.currentStreak.principles ?? 0} days</Text>

      {widget?.todayPrinciple ? (
        <View style={styles.card}>
          <Text style={styles.label}>Selected today</Text>
          <Text style={styles.body}>{widget.todayPrinciple.title}</Text>
        </View>
      ) : null}

      {today?.application?.application_description ? (
        <View style={styles.card}>
          <Text style={styles.label}>Application logged</Text>
          <Text style={styles.body}>{today.application.application_description}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>Apply today's principle in the web app or submit via API.</Text>
      )}

      <Pressable style={styles.btn} onPress={() => void useTaskStore.getState().loadDashboard()}>
        <Text style={styles.btnText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 56, backgroundColor: "#f9fafb" },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  streak: { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: "700", color: "#7c3aed", textTransform: "uppercase" },
  body: { fontSize: 15, marginTop: 6, color: "#111827" },
  hint: { color: "#9ca3af", fontSize: 14 },
  btn: {
    marginTop: 24,
    backgroundColor: "#5b21b6",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
