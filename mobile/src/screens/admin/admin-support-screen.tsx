import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { addTicketComment, getAdminTicketTimeline, getAdminTickets, updateAdminTicket } from "../../services/tickets";
import { useAuth } from "../../state/auth-context";
import type { TicketPriority, TicketStatus } from "../../types/api";
import { colors } from "../../theme";

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
    <View style={styles.container}>
      <Text style={styles.heading}>Support Tickets</Text>
      <Text style={styles.subtle}>Admin triage and replies.</Text>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={["all", ...STATUSES]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={[styles.filterChip, statusFilter === item ? styles.filterChipActive : null]} onPress={() => setStatusFilter(item as TicketStatus | "all")}>
              <Text style={styles.filterText}>{item}</Text>
            </Pressable>
          )}
        />
      </View>
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={["all", ...PRIORITIES]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={[styles.filterChip, priorityFilter === item ? styles.filterChipActive : null]} onPress={() => setPriorityFilter(item as TicketPriority | "all")}>
              <Text style={styles.filterText}>{item}</Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={ticketsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={ticketsQuery.isLoading ? <Text style={styles.subtle}>Loading tickets...</Text> : <Text style={styles.subtle}>No tickets found.</Text>}
        renderItem={({ item }) => (
          <Pressable style={[styles.card, selectedTicketId === item.id ? styles.cardActive : null]} onPress={() => setSelectedTicketId(item.id)}>
            <Text style={styles.title}>{item.subject}</Text>
            <Text style={styles.subtle}>{item.created_by?.full_name ?? item.created_by?.email ?? "User"}</Text>
            <Text style={styles.badge}>
              {item.status} · {item.priority}
            </Text>
          </Pressable>
        )}
      />

      {selectedTicket ? (
        <View style={styles.detail}>
          <Text style={styles.title}>{selectedTicket.subject}</Text>
          <Text style={styles.subtle}>{selectedTicket.description}</Text>
          <View style={styles.row}>
            <Pressable style={styles.action} onPress={() => updateMutation.mutate({ assignedAdminUserId: user?.id ?? null })}>
              <Text style={styles.actionText}>Assign me</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => updateMutation.mutate({ status: "resolved" })}>
              <Text style={styles.actionText}>Resolve</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => updateMutation.mutate({ status: "closed" })}>
              <Text style={styles.actionText}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={timelineQuery.data ?? []}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={timelineQuery.isLoading ? <Text style={styles.subtle}>Loading timeline...</Text> : <Text style={styles.subtle}>No timeline events.</Text>}
            renderItem={({ item }) => (
              <View style={styles.timelineItem}>
                <Text style={styles.timelineMeta}>
                  {item.event_type} · {new Date(item.created_at).toLocaleString()}
                </Text>
                {typeof item.detail?.comment === "string" ? <Text style={styles.subtle}>{item.detail.comment}</Text> : null}
              </View>
            )}
          />
          <TextInput
            style={styles.input}
            value={reply}
            onChangeText={setReply}
            placeholder="Reply to user..."
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.replyButton} onPress={() => commentMutation.mutate()} disabled={!reply.trim()}>
            <Text style={styles.replyText}>Post reply</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 14 },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtle: { color: colors.textSecondary },
  filterRow: { marginBottom: 8 },
  filterChip: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoftStrong },
  filterText: { color: colors.textSection },
  card: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  cardActive: { borderColor: colors.primary },
  title: { color: colors.textPrimary, fontWeight: "700" },
  badge: { color: colors.primaryMuted, marginTop: 4, textTransform: "uppercase", fontSize: 12 },
  detail: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 10, maxHeight: 340 },
  row: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 8 },
  action: { backgroundColor: colors.blueAction, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  actionText: { color: colors.textPrimary, fontWeight: "700" },
  timelineItem: { borderBottomColor: colors.borderStrong, borderBottomWidth: 1, paddingVertical: 6 },
  timelineMeta: { color: colors.textBody, fontWeight: "600", marginBottom: 3 },
  input: {
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: 8,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  replyButton: { backgroundColor: colors.primary, borderRadius: 8, alignItems: "center", paddingVertical: 10, marginTop: 8 },
  replyText: { color: colors.textPrimary, fontWeight: "700" },
});
