import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuthStore } from "../../store/authStore";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [busy, setBusy] = useState(false);
  const sendMagicLink = useAuthStore((s) => s.sendMagicLink);
  const verify = useAuthStore((s) => s.verify);
  const error = useAuthStore((s) => s.error);

  async function onSendLink() {
    setBusy(true);
    try {
      await sendMagicLink(email.trim());
      setStep("verify");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    setBusy(true);
    try {
      await verify(email.trim(), token.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.brand}>Torgima</Text>
      <Text style={styles.sub}>Execution on mobile — offline-first</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {step === "verify" ? (
        <TextInput
          style={styles.input}
          placeholder="Magic link token"
          value={token}
          onChangeText={setToken}
        />
      ) : null}

      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void (step === "email" ? onSendLink() : onVerify())}
      >
        <Text style={styles.btnText}>
          {step === "email" ? "Send magic link" : "Verify & sign in"}
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#faf5ff" },
  brand: { fontSize: 32, fontWeight: "800", color: "#5b21b6", marginBottom: 4 },
  sub: { fontSize: 14, color: "#6b7280", marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  btn: {
    backgroundColor: "#5b21b6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700" },
  error: { color: "#dc2626", marginTop: 12, fontSize: 13 },
});
