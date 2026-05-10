import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { addTicketComment, getAdminTicketTimeline, getAdminTickets, updateAdminTicket } from "../../services/tickets";
import { useAuth } from "../../state/auth-context";
import type { TicketPriority, TicketStatus } from "../../types/api";
import { colors } from "../../theme/colors";
import { Font } from "../../theme/fonts";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

const STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_user", "resolved", "closed"];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

export function AdminSupportScreen() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [reply, setReply] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["admin-tickets", statusFilter, priorityFilter],
    queryFn: () =>
      getAdminTickets(token, {
        status: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
      }),
  });
  const timelineQuery = useQuery({
    queryKey: ["admin-ticket-timeline", selectedTicketId],
    queryFn: () => getAdminTicketTimeline(token, selectedTicketId),
    enabled: Boolean(selectedTicketId),
  });

  const selectedTicket = useMemo(
    () => (ticketsQuery.data ?? []).find((ticket) => ticket.id === selectedTicketId) ?? null,
    [ticketsQuery.data, selectedTicketId],
  );

  const updateMutation = useMutation({
    mutationFn: (input: { status?: TicketStatus; priority?: TicketPriority; assignedAdminUserId?: string | null }) =>
      updateAdminTicket(token, selectedTicketId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-ticket-timeline", selectedTicketId] });
    },
    onError: (e) => Alert.alert("Ticket update failed", (e as Error).message),
  });

  const commentMutation = useMutation({
    mutationFn: () => addTicketComment(token, selectedTicketId, reply.trim()),
    onSuccess: () => {
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["admin-ticket-timeline", selectedTicketId] });
    },
    onError: (e) => Alert.alert("Reply failed", (e as Error).message),
  });

  return (
    <ScreenGradient>
      <View style={[vf.listPad, { flex: 1 }]}>
        <Text style={vf.h2}>Support Tickets</Text>
        <Text style={vf.lead}>Admin triage and replies.</Text>

        <Text style={vf.label}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 4, marginBottom: 12 }}>
          {(["all", ...STATUSES] as const).map((item) => (
            <Pressable
              key={item}
              style={[vf.linkChip, statusFilter === item ? { borderColor: colors.primary, backgroundColor: colors.primarySoft } : null]}
              onPress={() => setStatusFilter(item as TicketStatus | "all")}
            >
              <Text style={vf.linkChipLabel}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={vf.label}>Priority</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 4, marginBottom: 12 }}>
          {(["all", ...PRIORITIES] as const).map((item) => (
            <Pressable
              key={item}
              style={[vf.linkChip, priorityFilter === item ? { borderColor: colors.primary, backgroundColor: colors.primarySoft } : null]}
              onPress={() => setPriorityFilter(item as TicketPriority | "all")}
            >
              <Text style={vf.linkChipLabel}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <FlatList
          style={{ flex: 1 }}
          data={ticketsQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 12 }}
          ListEmptyComponent={
            ticketsQuery.isLoading ? <Text style={vf.muted}>Loading tickets...</Text> : <Text style={vf.muted}>No tickets found.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[vf.card, selectedTicketId === item.id ? { borderColor: colors.primary } : null]}
              onPress={() => setSelectedTicketId(item.id)}
            >
              <Text style={vf.cardTitle}>{item.subject}</Text>
              <Text style={vf.muted}>{item.created_by?.full_name ?? item.created_by?.email ?? "User"}</Text>
              <Text style={styles.badge}>
                {item.status} · {item.priority}
              </Text>
            </Pressable>
          )}
        />

        {selectedTicket ? (
          <View style={[vf.card, { maxHeight: 360, marginTop: 4 }]}>
            <Text style={vf.cardTitle}>{selectedTicket.subject}</Text>
            <Text style={vf.muted}>{selectedTicket.description}</Text>
            <View style={styles.actionRow}>
              <Pressable style={[vf.secondaryBtn, styles.actionFlex]} onPress={() => updateMutation.mutate({ assignedAdminUserId: user?.id ?? null })}>
                <Text style={vf.btnLabel}>Assign me</Text>
              </Pressable>
              <Pressable style={[vf.secondaryBtn, styles.actionFlex]} onPress={() => updateMutation.mutate({ status: "resolved" })}>
                <Text style={vf.btnLabel}>Resolve</Text>
              </Pressable>
              <Pressable style={[vf.secondaryBtn, styles.actionFlex]} onPress={() => updateMutation.mutate({ status: "closed" })}>
                <Text style={vf.btnLabel}>Close</Text>
              </Pressable>
            </View>
            <FlatList
              data={timelineQuery.data ?? []}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 160 }}
              nestedScrollEnabled
              ListEmptyComponent={
                timelineQuery.isLoading ? <Text style={vf.muted}>Loading timeline...</Text> : <Text style={vf.muted}>No timeline events.</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.timelineItem}>
                  <Text style={[vf.muted, { fontFamily: Font.outfitSemiBold, marginBottom: 4 }]}>
                    {item.event_type} · {new Date(item.created_at).toLocaleString()}
                  </Text>
                  {typeof item.detail?.comment === "string" ? <Text style={vf.muted}>{item.detail.comment}</Text> : null}
                </View>
              )}
            />
            <TextInput
              style={[vf.input, { marginBottom: 8 }]}
              value={reply}
              onChangeText={setReply}
              placeholder="Reply to user..."
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={vf.primaryBtn} onPress={() => commentMutation.mutate()} disabled={!reply.trim()}>
              <Text style={vf.btnLabel}>Post reply</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  badge: { color: colors.primaryMuted, marginTop: 8, textTransform: "uppercase", fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 8, flexWrap: "wrap" },
  actionFlex: { flex: 1, minWidth: 100, marginBottom: 0 },
  timelineItem: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 8 },
});
