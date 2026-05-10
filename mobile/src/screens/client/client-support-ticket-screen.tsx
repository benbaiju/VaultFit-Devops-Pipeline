import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useLayoutEffect, useMemo, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addTicketComment, getMyTickets, getTicketTimeline } from "../../services/tickets";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { Font } from "../../theme/fonts";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";
import type { SupportStackParamList } from "./support-types";

type TicketRoute = RouteProp<SupportStackParamList, "SupportTicket">;

export function ClientSupportTicketScreen() {
  const route = useRoute<TicketRoute>();
  const navigation = useNavigation();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const ticketId = route.params.ticketId;
  const [reply, setReply] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: () => getMyTickets(token),
  });

  const timelineQuery = useQuery({
    queryKey: ["ticket-timeline", ticketId],
    queryFn: () => getTicketTimeline(token, ticketId),
    enabled: Boolean(ticketId),
  });

  const ticket = useMemo(() => ticketsQuery.data?.find((t) => t.id === ticketId), [ticketId, ticketsQuery.data]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: ticket?.subject ? "Ticket" : "Support ticket" });
  }, [navigation, ticket?.subject]);

  const commentMutation = useMutation({
    mutationFn: () => addTicketComment(token, ticketId, reply.trim()),
    onSuccess: () => {
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["ticket-timeline", ticketId] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e) => Alert.alert("Reply failed", (e as Error).message),
  });

  if (!ticketId) return null;

  if (ticketsQuery.isLoading) {
    return (
      <ScreenGradient>
        <View style={[styles.flex, styles.centered]}>
          <Text style={vf.muted}>Loading ticket...</Text>
        </View>
      </ScreenGradient>
    );
  }

  if (!ticket) {
    return (
      <ScreenGradient>
        <View style={[styles.flex, styles.centered, { paddingHorizontal: 18 }]}>
          <View style={vf.card}>
            <Text style={vf.cardTitle}>Ticket not found</Text>
            <Text style={vf.muted}>This ticket is no longer available in your list.</Text>
            <Pressable style={[vf.primaryBtn, { marginTop: 12 }]} onPress={() => navigation.goBack()}>
              <Text style={vf.btnLabel}>Back to support</Text>
            </Pressable>
          </View>
        </View>
      </ScreenGradient>
    );
  }

  const ticketClosed = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <ScreenGradient>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        <View style={styles.flex}>
          <View style={[vf.card, styles.headerCard]}>
            <Text style={vf.cardTitle}>{ticket.subject}</Text>
            <Text style={vf.muted}>
              {ticket.status} · {ticket.priority} · {ticket.category}
            </Text>
            <Text style={[vf.body, { marginTop: 8 }]}>{ticket.description}</Text>
          </View>

          <View style={styles.timelineWrap}>
            <FlatList
              data={timelineQuery.data ?? []}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                timelineQuery.isLoading ? <Text style={vf.muted}>Loading conversation...</Text> : <Text style={vf.muted}>No conversation items.</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineMeta}>
                    {item.event_type} · {new Date(item.created_at).toLocaleString()}
                  </Text>
                  {typeof item.detail?.comment === "string" ? <Text style={vf.muted}>{item.detail.comment}</Text> : null}
                </View>
              )}
              contentContainerStyle={styles.timelineContent}
              showsVerticalScrollIndicator={false}
            />
          </View>

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {ticketClosed ? <Text style={[vf.muted, { marginBottom: 8 }]}>This ticket is closed and no longer accepts comments.</Text> : null}
            <TextInput
              style={vf.input}
              value={reply}
              onChangeText={setReply}
              placeholder={ticketClosed ? "Ticket closed" : "Reply to support"}
              placeholderTextColor={colors.textMuted}
              editable={!ticketClosed}
              multiline
            />
            <Pressable
              style={vf.primaryBtn}
              disabled={!reply.trim() || commentMutation.isPending || ticketClosed}
              onPress={() => commentMutation.mutate()}
            >
              <Text style={vf.btnLabel}>{commentMutation.isPending ? "Posting..." : "Post comment"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  headerCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  timelineWrap: {
    flex: 1,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "rgba(2, 6, 23, 0.35)",
    overflow: "hidden",
  },
  timelineContent: { paddingHorizontal: 12, paddingVertical: 10 },
  timelineItem: { borderBottomWidth: 1, borderBottomColor: colors.borderStrong, paddingVertical: 8 },
  timelineMeta: { color: colors.textBody, marginBottom: 4, fontFamily: Font.outfitSemiBold },
  composer: { paddingHorizontal: 12, paddingTop: 10 },
});
