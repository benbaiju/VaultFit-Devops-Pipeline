import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { createService, getServices } from "../../services/services";
import { getMyTrainerProfile } from "../../services/trainers";
import { useAuth } from "../../state/auth-context";

export function TrainerServicesScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [price, setPrice] = useState("90");

  const profileQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
  });
  const trainerId = profileQuery.data?.id ?? "";
  const servicesQuery = useQuery({
    queryKey: ["services", trainerId],
    queryFn: () => getServices(trainerId),
    enabled: Boolean(trainerId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createService(token, trainerId, {
        title: title.trim(),
        serviceType: "session",
        durationMinutes: Number(durationMinutes || 60),
        price: Number(price || 0),
      }),
    onSuccess: () => {
      setTitle("");
      setDurationMinutes("60");
      setPrice("90");
      void queryClient.invalidateQueries({ queryKey: ["services", trainerId] });
    },
    onError: (e) => Alert.alert("Create service failed", (e as Error).message),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Services</Text>
      <Text style={styles.subtle}>Create and manage your service offerings.</Text>

      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Service title" placeholderTextColor="#64748b" />
      <TextInput
        style={styles.input}
        value={durationMinutes}
        onChangeText={setDurationMinutes}
        keyboardType="number-pad"
        placeholder="Duration (minutes)"
        placeholderTextColor="#64748b"
      />
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Price" placeholderTextColor="#64748b" />
      <Pressable style={styles.button} disabled={!title.trim() || createMutation.isPending || !trainerId} onPress={() => createMutation.mutate()}>
        <Text style={styles.buttonText}>{createMutation.isPending ? "Creating..." : "Create service"}</Text>
      </Pressable>

      <FlatList
        data={servicesQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={servicesQuery.isLoading ? <Text style={styles.subtle}>Loading services...</Text> : <Text style={styles.subtle}>No services yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtle}>
              {item.duration_minutes} min · ${item.price}
            </Text>
            <Text style={styles.badge}>{item.service_type}</Text>
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
  button: { backgroundColor: "#4f46e5", borderRadius: 8, alignItems: "center", paddingVertical: 10, marginBottom: 12 },
  buttonText: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#0f172a", borderColor: "#1e293b", borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  title: { color: "#fff", fontWeight: "700" },
  badge: { color: "#93c5fd", marginTop: 5, textTransform: "uppercase" },
});
