import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { getBookings } from "../../services/bookings";
import { createPlan, getPlans } from "../../services/plans";
import { useAuth } from "../../state/auth-context";

export function TrainerPlansScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => getPlans(token),
  });
  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const clientOptions = Array.from(
    new Set((bookingsQuery.data ?? []).map((b) => b.client_id).filter((id): id is string => Boolean(id))),
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createPlan(token, {
        clientId,
        title: title.trim(),
        planType: "fitness",
        content: { summary: "Mobile plan draft", weeks: [] },
      }),
    onSuccess: () => {
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e) => Alert.alert("Create plan failed", (e as Error).message),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Client Plans</Text>
      <Text style={styles.subtle}>Create and review plans assigned to clients.</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Plan title" placeholderTextColor="#64748b" />
      <FlatList
        horizontal
        data={clientOptions}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <Pressable style={[styles.chip, clientId === item ? styles.chipActive : null]} onPress={() => setClientId(item)}>
            <Text style={styles.chipText}>{item.slice(0, 8)}...</Text>
          </Pressable>
        )}
      />
      <Pressable style={styles.button} disabled={!title.trim() || !clientId || createMutation.isPending} onPress={() => createMutation.mutate()}>
        <Text style={styles.buttonText}>{createMutation.isPending ? "Creating..." : "Create plan"}</Text>
      </Pressable>

      <FlatList
        data={plansQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={plansQuery.isLoading ? <Text style={styles.subtle}>Loading plans...</Text> : <Text style={styles.subtle}>No plans yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtle}>
              {item.plan_type} · {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", padding: 14 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtle: { color: "#94a3b8" },
  input: { borderWidth: 1, borderColor: "#334155", borderRadius: 8, color: "#fff", paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginBottom: 8 },
  chipActive: { borderColor: "#4f46e5", backgroundColor: "rgba(79,70,229,0.25)" },
  chipText: { color: "#cbd5e1" },
  button: { backgroundColor: "#4f46e5", borderRadius: 8, alignItems: "center", paddingVertical: 10, marginBottom: 10 },
  buttonText: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#0f172a", borderColor: "#1e293b", borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  title: { color: "#fff", fontWeight: "700" },
});
