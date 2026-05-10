import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { createService, getServices } from "../../services/services";
import { getMyTrainerProfile } from "../../services/trainers";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
      <View style={[vf.listPad, { flex: 1 }]}>
        <Text style={vf.h2}>Services</Text>
        <Text style={vf.lead}>Create and manage your service offerings.</Text>
        <View style={vf.card}>
          <Text style={vf.label}>Service title</Text>
          <TextInput style={vf.input} value={title} onChangeText={setTitle} placeholder="Service title" placeholderTextColor={colors.textMuted} />
          <Text style={vf.label}>Duration (minutes)</Text>
          <TextInput
            style={vf.input}
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="number-pad"
            placeholder="Duration (minutes)"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={vf.label}>Price</Text>
          <TextInput style={vf.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Price" placeholderTextColor={colors.textMuted} />
          <Pressable style={vf.primaryBtn} disabled={!title.trim() || createMutation.isPending || !trainerId} onPress={() => createMutation.mutate()}>
            <Text style={vf.btnLabel}>{createMutation.isPending ? "Creating..." : "Create service"}</Text>
          </Pressable>
        </View>

        <Text style={[vf.h3, { marginTop: 8 }]}>Your services</Text>
        <FlatList
          style={{ flex: 1 }}
          data={servicesQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            servicesQuery.isLoading ? <Text style={vf.muted}>Loading services...</Text> : <Text style={vf.muted}>No services yet.</Text>
          }
          renderItem={({ item }) => (
            <View style={vf.card}>
              <Text style={vf.cardTitle}>{item.title}</Text>
              <Text style={vf.muted}>
                {item.duration_minutes} min · ${item.price}
              </Text>
              <Text style={styles.badge}>{item.service_type}</Text>
            </View>
          )}
        />
      </View>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  badge: { color: colors.primaryMuted, marginTop: 8, textTransform: "uppercase", fontSize: 12 },
});
