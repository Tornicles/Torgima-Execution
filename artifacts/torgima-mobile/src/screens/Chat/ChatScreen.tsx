import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { api } from "../../services/apiClient";
import { offlineQueue } from "../../utils/offlineQueue";

type Message = { id: string; content: string; createdAt: string };

export function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ messages: Array<{ id: string; content?: string; createdAt: string }> }>(
        "/chat/messages?limit=40",
      );
      setMessages(
        (res.messages ?? []).map((m) => ({
          id: m.id,
          content: m.content ?? "",
          createdAt: m.createdAt,
        })),
      );
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, content, createdAt: new Date().toISOString() },
    ]);

    try {
      await api.post("/chat/messages", {
        messageType: content.toLowerCase().includes("blocked") ? "blocker" : "text",
        content,
      });
    } catch {
      await offlineQueue.addAction({
        type: "create",
        resource: "chat/messages",
        payload: { messageType: "text", content },
      });
    }
    void load();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Chat</Text>
      <Pressable onPress={() => void load()}>
        <Text style={styles.link}>{loading ? "Loading…" : "Refresh"}</Text>
      </Pressable>

      <FlatList
        data={[...messages].reverse()}
        keyExtractor={(m) => m.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{item.content}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Log thoughts and blockers.</Text>}
      />

      <View style={styles.footer}>
        <TextInput
          style={styles.input}
          placeholder="Message…"
          value={text}
          onChangeText={setText}
        />
        <Pressable style={styles.send} onPress={() => void send()}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 56, backgroundColor: "#f9fafb" },
  title: { fontSize: 28, fontWeight: "800", paddingHorizontal: 20 },
  link: { color: "#5b21b6", paddingHorizontal: 20, marginBottom: 8, fontSize: 13 },
  list: { flex: 1, paddingHorizontal: 16 },
  bubble: {
    alignSelf: "flex-end",
    backgroundColor: "#5b21b6",
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    maxWidth: "85%",
  },
  bubbleText: { color: "#fff", fontSize: 14 },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
  footer: { flexDirection: "row", padding: 12, gap: 8, borderTopWidth: 1, borderColor: "#e5e7eb" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  send: { backgroundColor: "#5b21b6", borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  sendText: { color: "#fff", fontWeight: "700" },
});
