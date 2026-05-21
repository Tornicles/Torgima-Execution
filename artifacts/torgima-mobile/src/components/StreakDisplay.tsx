import { View, Text, StyleSheet } from "react-native";

const ICONS: Record<string, string> = {
  execution: "🔥",
  principles: "⚡",
  content: "✍️",
};

export function StreakDisplay({ type, count }: { type: string; count: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{ICONS[type] ?? "📈"}</Text>
      <Text style={styles.count}>{count}d</Text>
      <Text style={styles.label}>{type}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  icon: { fontSize: 18 },
  count: { fontSize: 16, fontWeight: "800", color: "#111827" },
  label: { fontSize: 9, color: "#9ca3af", textTransform: "capitalize" },
});
