import { View, Text, StyleSheet } from "react-native";

export function AvatarDisplay({ level, xp }: { level: number; xp: number }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.avatar}>
        <Text style={styles.level}>{level}</Text>
      </View>
      <Text style={styles.xp}>{xp.toLocaleString()} XP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#5b21b6",
    alignItems: "center",
    justifyContent: "center",
  },
  level: { color: "#fff", fontSize: 22, fontWeight: "800" },
  xp: { fontSize: 10, color: "#6b7280", marginTop: 4, fontWeight: "600" },
});
