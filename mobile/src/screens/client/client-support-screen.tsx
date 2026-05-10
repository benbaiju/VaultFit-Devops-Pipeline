import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { addTicketComment, createTicket, getMyTickets, getTicketTimeline } from "../../services/tickets";
import type { TicketCategory, TicketPriority } from "../../types/api";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { Font } from "../../theme/fonts";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
    <View style={styles.shell}>
      <Text style={vf.h2}>Support</Text>
      <Text style={[vf.lead, { marginBottom: 12 }]}>Open tickets — same flows as web support.</Text>
      <Text style={vf.label}>Subject</Text>
      <TextInput style={[vf.input]} value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={colors.textMuted} />
      <TextInput style={[vf.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="Describe your issue" placeholderTextColor={colors.textMuted} multiline />
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
        style={[vf.primaryBtn, { marginBottom: 16 }]}
        disabled={subject.trim().length < 3 || description.trim().length < 5 || createMutation.isPending}
        onPress={() => createMutation.mutate()}
      >
        <Text style={vf.btnLabel}>{createMutation.isPending ? "Submitting..." : "Submit ticket"}</Text>
      </Pressable>

      <Text style={vf.h3}>Your tickets</Text>
      <FlatList
        data={ticketsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={ticketsQuery.isLoading ? <Text style={vf.muted}>Loading tickets...</Text> : <Text style={vf.muted}>No tickets yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={[vf.card, selectedTicketId === item.id ? { borderColor: colors.primary } : null]}
            onPress={() => setSelectedTicketId(item.id)}
          >
            <Text style={vf.cardTitle}>{item.subject}</Text>
            <Text style={vf.muted}>
              {item.status} · {item.priority}
            </Text>
          </Pressable>
        )}
      />

      {selectedTicket ? (
        <View style={[vf.card, { maxHeight: 320 }]}>
          <FlatList
            data={timelineQuery.data ?? []}
            keyExtractor={(item) => item.id}
            scrollEnabled
            nestedScrollEnabled
            ListEmptyComponent={
              timelineQuery.isLoading ? <Text style={vf.muted}>Loading conversation...</Text> : <Text style={vf.muted}>No conversation items.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.timelineItem}>
                <Text style={[styles.timelineMeta, { fontFamily: Font.outfitSemiBold }]}>
                  {item.event_type} · {new Date(item.created_at).toLocaleString()}
                </Text>
                {typeof item.detail?.comment === "string" ? <Text style={vf.muted}>{item.detail.comment}</Text> : null}
              </View>
            )}
          />
          <TextInput style={vf.input} value={reply} onChangeText={setReply} placeholder="Reply to support" placeholderTextColor={colors.textMuted} />
          <Pressable style={[vf.primaryBtn, { marginTop: 8 }]} disabled={!reply.trim() || commentMutation.isPending} onPress={() => commentMutation.mutate()}>
            <Text style={vf.btnLabel}>{commentMutation.isPending ? "Posting..." : "Post comment"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
  row: { marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 6,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoftStrong },
  chipText: { color: colors.textSection, fontFamily: Font.outfitMedium },
  textarea: { minHeight: 88, textAlignVertical: "top" },
  timelineItem: { borderBottomWidth: 1, borderBottomColor: colors.borderStrong, paddingVertical: 8 },
  timelineMeta: { color: colors.textBody, marginBottom: 4 },
});
