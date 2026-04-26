import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Role } from "../../types/api";
import { useAuth } from "../../state/auth-context";

export function RegisterScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("client");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    try {
      setIsLoading(true);
      await register({ fullName: fullName.trim(), email: email.trim(), password, role });
    } catch (e) {
      Alert.alert("Registration failed", (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password (min 8)" secureTextEntry value={password} onChangeText={setPassword} />
      <View style={styles.roleRow}>
        {(["client", "trainer", "nutritionist"] as Role[]).map((item) => (
          <Pressable key={item} style={[styles.roleChip, role === item ? styles.roleChipActive : null]} onPress={() => setRole(item)}>
            <Text style={styles.roleText}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.button} onPress={handleRegister} disabled={isLoading || !fullName || !email || password.length < 8}>
        <Text style={styles.buttonText}>{isLoading ? "Creating..." : "Create account"}</Text>
      </Pressable>
      <Pressable onPress={onGoLogin}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#020817" },
  title: { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: 16 },
  input: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    marginBottom: 10,
  },
  roleRow: { flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  roleChip: { borderWidth: 1, borderColor: "#334155", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  roleChipActive: { borderColor: "#4f46e5", backgroundColor: "rgba(79,70,229,0.2)" },
  roleText: { color: "#cbd5e1", textTransform: "capitalize" },
  button: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#fff", fontWeight: "700" },
  link: { color: "#93c5fd", textAlign: "center", marginTop: 14 },
});
