import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../../services/messaging";
import { useAuth } from "../../state/auth-context";

export function NotificationsScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(token),
  });

  const markOneMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(token, notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = notificationsQuery.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Notifications</Text>
        <Pressable style={styles.headerButton} onPress={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
          <Text style={styles.headerButtonText}>{markAllMutation.isPending ? "Working..." : "Mark all read"}</Text>
        </Pressable>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.subtle}>{notificationsQuery.isLoading ? "Loading notifications..." : "No notifications yet."}</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <View style={styles.row}>
              <Text style={[styles.badge, item.is_read ? styles.read : styles.unread]}>{item.is_read ? "Read" : "Unread"}</Text>
              {!item.is_read ? (
                <Pressable style={styles.smallButton} onPress={() => markOneMutation.mutate(item.id)} disabled={markOneMutation.isPending}>
                  <Text style={styles.smallButtonText}>Mark read</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", padding: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700" },
  headerButton: { borderWidth: 1, borderColor: "#334155", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  headerButtonText: { color: "#cbd5e1", fontWeight: "600" },
  subtle: { color: "#94a3b8" },
  item: { borderWidth: 1, borderColor: "#1e293b", borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: "#0f172a" },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  body: { color: "#cbd5e1" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  badge: { fontSize: 12, fontWeight: "700" },
  read: { color: "#94a3b8" },
  unread: { color: "#22c55e" },
  smallButton: { borderWidth: 1, borderColor: "#4f46e5", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  smallButtonText: { color: "#c7d2fe", fontWeight: "700" },
});
