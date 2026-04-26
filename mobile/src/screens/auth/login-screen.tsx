import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../../state/auth-context";

export function LoginScreen({ onGoRegister }: { onGoRegister: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    try {
      setIsLoading(true);
      await login(email.trim(), password);
    } catch (e) {
      Alert.alert("Login failed", (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VaultFit Mobile</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable style={styles.button} onPress={handleLogin} disabled={isLoading || !email || !password}>
        <Text style={styles.buttonText}>{isLoading ? "Signing in..." : "Sign in"}</Text>
      </Pressable>
      <Pressable onPress={onGoRegister}>
        <Text style={styles.link}>Create account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#020817" },
  title: { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: 8 },
  subtitle: { color: "#94a3b8", marginBottom: 16 },
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
  button: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#fff", fontWeight: "700" },
  link: { color: "#93c5fd", textAlign: "center", marginTop: 14 },
});
