import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getAdminReviewTimeline, getAdminTrainers, getAdminUsers, setTrainerVerifiedState, setUserAccess } from "../../services/admin";
import { useAuth } from "../../state/auth-context";

export function AdminControlScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getAdminUsers(token),
  });
  const trainersQuery = useQuery({
    queryKey: ["admin-trainers"],
    queryFn: () => getAdminTrainers(token),
  });
  const timelineQuery = useQuery({
    queryKey: ["admin-review-timeline"],
    queryFn: () => getAdminReviewTimeline(token),
  });

  const accessMutation = useMutation({
    mutationFn: (input: { userId: string; suspended: boolean }) => setUserAccess(token, input.userId, input.suspended),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-review-timeline"] });
    },
    onError: (e) => Alert.alert("Access update failed", (e as Error).message),
  });

  const trainerMutation = useMutation({
    mutationFn: (input: { trainerId: string; verified: boolean }) => setTrainerVerifiedState(token, input.trainerId, input.verified),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-trainers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-review-timeline"] });
    },
    onError: (e) => Alert.alert("Trainer update failed", (e as Error).message),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Control Center</Text>
      <Text style={styles.subtle}>Manage trainer verification and user access.</Text>

      <Text style={styles.section}>Trainers</Text>
      <FlatList
        data={trainersQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={trainersQuery.isLoading ? <Text style={styles.subtle}>Loading trainers...</Text> : <Text style={styles.subtle}>No trainers found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.profiles?.full_name ?? item.profiles?.email ?? "Trainer"}</Text>
            <Text style={styles.subtle}>{item.specialty ?? "No specialty"}</Text>
            <Pressable
              style={[styles.button, item.verified ? styles.warnButton : styles.successButton]}
              onPress={() => trainerMutation.mutate({ trainerId: item.id, verified: !item.verified })}
            >
              <Text style={styles.buttonText}>{item.verified ? "Revoke verified" : "Grant verified"}</Text>
            </Pressable>
          </View>
        )}
      />

      <Text style={styles.section}>Users</Text>
      <FlatList
        data={(usersQuery.data ?? []).filter((u) => u.role !== "admin")}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={usersQuery.isLoading ? <Text style={styles.subtle}>Loading users...</Text> : <Text style={styles.subtle}>No users found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.full_name ?? item.email}</Text>
            <Text style={styles.subtle}>
              {item.role} · {item.access_suspended ? "Suspended" : "Active"}
            </Text>
            <Pressable
              style={[styles.button, item.access_suspended ? styles.successButton : styles.warnButton]}
              onPress={() => accessMutation.mutate({ userId: item.id, suspended: !item.access_suspended })}
            >
              <Text style={styles.buttonText}>{item.access_suspended ? "Restore access" : "Suspend access"}</Text>
            </Pressable>
          </View>
        )}
      />

      <Text style={styles.section}>Recent review timeline</Text>
      <FlatList
        data={(timelineQuery.data?.items ?? []).slice(0, 8)}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={timelineQuery.isLoading ? <Text style={styles.subtle}>Loading timeline...</Text> : <Text style={styles.subtle}>No timeline items.</Text>}
        renderItem={({ item }) => (
          <View style={styles.timelineRow}>
            <Text style={styles.timelineAction}>{item.action}</Text>
            <Text style={styles.subtle}>{new Date(item.at).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", padding: 14 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 6 },
  section: { color: "#cbd5e1", fontSize: 16, fontWeight: "700", marginTop: 14, marginBottom: 8 },
  subtle: { color: "#94a3b8" },
  card: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  title: { color: "#fff", fontWeight: "700" },
  button: { marginTop: 8, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  successButton: { backgroundColor: "#166534" },
  warnButton: { backgroundColor: "#7f1d1d" },
  buttonText: { color: "#fff", fontWeight: "700" },
  timelineRow: { borderBottomColor: "#1e293b", borderBottomWidth: 1, paddingVertical: 8 },
  timelineAction: { color: "#e2e8f0", fontWeight: "600" },
});
