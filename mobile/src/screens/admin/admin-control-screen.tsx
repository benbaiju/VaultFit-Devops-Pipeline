import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getAdminReviewTimeline, getAdminTrainers, getAdminUsers, setTrainerVerifiedState, setUserAccess } from "../../services/admin";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { Font } from "../../theme/fonts";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
    <View style={styles.shell}>
      <Text style={vf.h2}>Control center</Text>
      <Text style={vf.lead}>Trainer verification and user access.</Text>

      <Text style={[vf.h3, { marginTop: 20 }]}>Trainers</Text>
      <FlatList
        data={trainersQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          trainersQuery.isLoading ? <Text style={vf.muted}>Loading trainers...</Text> : <Text style={vf.muted}>No trainers found.</Text>
        }
        renderItem={({ item }) => (
          <View style={vf.card}>
            <Text style={vf.cardTitle}>{item.profiles?.full_name ?? item.profiles?.email ?? "Trainer"}</Text>
            <Text style={vf.body}>{item.specialty ?? "No specialty"}</Text>
            <Pressable
              style={[item.verified ? styles.warnButton : styles.successButton]}
              onPress={() => trainerMutation.mutate({ trainerId: item.id, verified: !item.verified })}
            >
              <Text style={[vf.btnLabel, { textAlign: "center" }]}>{item.verified ? "Revoke verified" : "Grant verified"}</Text>
            </Pressable>
          </View>
        )}
      />

      <Text style={vf.h3}>Users</Text>
      <FlatList
        data={(usersQuery.data ?? []).filter((u) => u.role !== "admin")}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={usersQuery.isLoading ? <Text style={vf.muted}>Loading users...</Text> : <Text style={vf.muted}>No users found.</Text>}
        renderItem={({ item }) => (
          <View style={vf.card}>
            <Text style={vf.cardTitle}>{item.full_name ?? item.email}</Text>
            <Text style={vf.body}>
              {item.role} · {item.access_suspended ? "Suspended" : "Active"}
            </Text>
            <Pressable
              style={[item.access_suspended ? styles.successButton : styles.warnButton]}
              onPress={() => accessMutation.mutate({ userId: item.id, suspended: !item.access_suspended })}
            >
              <Text style={[vf.btnLabel, { textAlign: "center" }]}>{item.access_suspended ? "Restore access" : "Suspend access"}</Text>
            </Pressable>
          </View>
        )}
      />

      <Text style={vf.h3}>Recent review timeline</Text>
      <FlatList
        data={(timelineQuery.data?.items ?? []).slice(0, 8)}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          timelineQuery.isLoading ? <Text style={vf.muted}>Loading timeline...</Text> : <Text style={vf.muted}>No timeline items.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.timelineRow}>
            <Text style={styles.timelineAction}>{item.action}</Text>
            <Text style={vf.muted}>{new Date(item.at).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  successButton: { marginTop: 12, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: "#166534" },
  warnButton: { marginTop: 12, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: colors.dangerDark },
  timelineRow: { borderBottomColor: colors.borderStrong, borderBottomWidth: 1, paddingVertical: 10 },
  timelineAction: { color: colors.textBody, marginBottom: 4, fontFamily: Font.outfitSemiBold },
});
