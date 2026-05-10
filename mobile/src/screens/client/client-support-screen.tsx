import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { addTicketComment, createTicket, getMyTickets, getTicketTimeline } from "../../services/tickets";
import type { TicketCategory, TicketPriority } from "../../types/api";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme";

const CATEGORIES: TicketCategory[] = ["booking", "payment", "verification", "account", "technical", "other"];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

export function ClientSupportScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("other");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [reply, setReply] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: () => getMyTickets(token),
  });
  const timelineQuery = useQuery({
    queryKey: ["ticket-timeline", selectedTicketId],
    queryFn: () => getTicketTimeline(token, selectedTicketId),
    enabled: Boolean(selectedTicketId),
  });
  const createMutation = useMutation({
    mutationFn: () => createTicket(token, { subject: subject.trim(), description: description.trim(), category, priority }),
    onSuccess: (ticket) => {
      setSubject("");
      setDescription("");
      setSelectedTicketId(ticket.id);
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e) => Alert.alert("Ticket create failed", (e as Error).message),
  });
  const commentMutation = useMutation({
    mutationFn: () => addTicketComment(token, selectedTicketId, reply.trim()),
    onSuccess: () => {
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["ticket-timeline", selectedTicketId] });
    },
    onError: (e) => Alert.alert("Reply failed", (e as Error).message),
  });

  const selectedTicket = useMemo(
    () => (ticketsQuery.data ?? []).find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, ticketsQuery.data],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Support</Text>
      <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={colors.textMuted} />
      <TextInput
        style={[styles.input, styles.textarea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe your issue"
        placeholderTextColor={colors.textMuted}
        multiline
      />
      <View style={styles.row}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable style={[styles.chip, category === item ? styles.chipActive : null]} onPress={() => setCategory(item)}>
              <Text style={styles.chipText}>{item}</Text>
            </Pressable>
          )}
        />
      </View>
      <View style={styles.row}>
        <FlatList
          horizontal
          data={PRIORITIES}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable style={[styles.chip, priority === item ? styles.chipActive : null]} onPress={() => setPriority(item)}>
              <Text style={styles.chipText}>{item}</Text>
            </Pressable>
          )}
        />
      </View>
      <Pressable
        style={styles.button}
        disabled={subject.trim().length < 3 || description.trim().length < 5 || createMutation.isPending}
        onPress={() => createMutation.mutate()}
      >
        <Text style={styles.buttonText}>{createMutation.isPending ? "Submitting..." : "Submit ticket"}</Text>
      </Pressable>

      <FlatList
        data={ticketsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={ticketsQuery.isLoading ? <Text style={styles.subtle}>Loading tickets...</Text> : <Text style={styles.subtle}>No tickets yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={[styles.ticketCard, selectedTicketId === item.id ? styles.ticketCardActive : null]} onPress={() => setSelectedTicketId(item.id)}>
            <Text style={styles.title}>{item.subject}</Text>
            <Text style={styles.subtle}>
              {item.status} · {item.priority}
            </Text>
          </Pressable>
        )}
      />

      {selectedTicket ? (
        <View style={styles.timelineWrap}>
          <FlatList
            data={timelineQuery.data ?? []}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={timelineQuery.isLoading ? <Text style={styles.subtle}>Loading conversation...</Text> : <Text style={styles.subtle}>No conversation items.</Text>}
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
            placeholder="Reply to support"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.button} disabled={!reply.trim() || commentMutation.isPending} onPress={() => commentMutation.mutate()}>
            <Text style={styles.buttonText}>{commentMutation.isPending ? "Posting..." : "Post comment"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 14 },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtle: { color: colors.textSecondary },
  row: { marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoftStrong },
  chipText: { color: colors.textSection },
  input: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 8, color: colors.textPrimary, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  textarea: { minHeight: 72, textAlignVertical: "top" },
  button: { backgroundColor: colors.primary, borderRadius: 8, alignItems: "center", paddingVertical: 10, marginBottom: 10 },
  buttonText: { color: colors.textPrimary, fontWeight: "700" },
  ticketCard: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  ticketCardActive: { borderColor: colors.primary },
  title: { color: colors.textPrimary, fontWeight: "700" },
  timelineWrap: { marginTop: 8, backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: 10, padding: 10, maxHeight: 300 },
  timelineItem: { borderBottomWidth: 1, borderBottomColor: colors.borderStrong, paddingVertical: 7 },
  timelineMeta: { color: colors.textBody, fontWeight: "600" },
});
