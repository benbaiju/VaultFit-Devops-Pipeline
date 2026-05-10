import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, Pressable, Text, View } from "react-native";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../../services/messaging";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { Font } from "../../theme/fonts";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={vf.listPad}
        ListHeaderComponent={
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
            <Text style={vf.h2}>Notifications</Text>
            <Pressable
              style={[vf.secondaryBtn, { marginBottom: 0, alignSelf: "flex-start" }]}
              onPress={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
            >
              <Text style={vf.btnLabel}>{markAllMutation.isPending ? "…" : "Mark all read"}</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <Text style={vf.muted}>{notificationsQuery.isLoading ? "Loading notifications..." : "No notifications yet."}</Text>
        }
        renderItem={({ item }) => (
          <View style={vf.card}>
            <Text style={[vf.cardTitle, { marginBottom: 6 }]}>{item.title}</Text>
            <Text style={vf.body}>{item.body}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <Text
                style={[vf.muted, { fontFamily: Font.outfitSemiBold }, !item.is_read ? { color: colors.successBright } : null]}
              >
                {item.is_read ? "Read" : "Unread"}
              </Text>
              {!item.is_read ? (
                <Pressable style={[vf.secondaryBtn, { paddingVertical: 8, marginBottom: 0 }]} onPress={() => markOneMutation.mutate(item.id)}>
                  <Text style={vf.btnLabel}>Mark read</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
    </ScreenGradient>
  );
}
