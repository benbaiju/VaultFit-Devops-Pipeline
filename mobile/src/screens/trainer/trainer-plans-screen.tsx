import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { getBookings } from "../../services/bookings";
import { createPlan, getPlans } from "../../services/plans";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
      <View style={[vf.listPad, { flex: 1 }]}>
        <Text style={vf.h2}>Client Plans</Text>
        <Text style={vf.lead}>Create and review plans assigned to clients.</Text>
        <View style={vf.card}>
          <Text style={vf.label}>Plan title</Text>
          <TextInput style={vf.input} value={title} onChangeText={setTitle} placeholder="Plan title" placeholderTextColor={colors.textMuted} />
          <Text style={vf.label}>Client</Text>
          {clientOptions.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 4, marginBottom: 8 }}>
              {clientOptions.map((item) => (
                <Pressable
                  key={item}
                  style={[vf.linkChip, clientId === item ? { borderColor: colors.primary, backgroundColor: colors.primarySoft } : null]}
                  onPress={() => setClientId(item)}
                >
                  <Text style={vf.linkChipLabel}>{item.slice(0, 8)}…</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={[vf.muted, { marginBottom: 12 }]}>Book a client session first so plan recipients appear here.</Text>
          )}
          <Pressable
            style={vf.primaryBtn}
            disabled={!title.trim() || !clientId || createMutation.isPending}
            onPress={() => createMutation.mutate()}
          >
            <Text style={vf.btnLabel}>{createMutation.isPending ? "Creating..." : "Create plan"}</Text>
          </Pressable>
        </View>

        <Text style={[vf.h3, { marginTop: 8 }]}>Your plans</Text>
        <FlatList
          style={{ flex: 1 }}
          data={plansQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            plansQuery.isLoading ? <Text style={vf.muted}>Loading plans...</Text> : <Text style={vf.muted}>No plans yet.</Text>
          }
          renderItem={({ item }) => (
            <View style={vf.card}>
              <Text style={vf.cardTitle}>{item.title}</Text>
              <Text style={vf.muted}>
                {item.plan_type} · {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          )}
        />
      </View>
    </ScreenGradient>
  );
}
