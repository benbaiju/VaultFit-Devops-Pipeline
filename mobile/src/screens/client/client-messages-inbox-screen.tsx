import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { getConversations } from "../../services/messaging";
import { getTrainers } from "../../services/trainers";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { Font } from "../../theme/fonts";
import type { Conversation } from "../../types/api";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";
import { realtimeClient } from "../../lib/supabase-realtime";
import type { MessagesStackParamList } from "./messaging-types";

type MessagesNav = NativeStackNavigationProp<MessagesStackParamList, "MessagesInbox">;

export function ClientMessagesInboxScreen() {
  const navigation = useNavigation<MessagesNav>();
  const { token, user } = useAuth();

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(token, true),
  });

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
    enabled: user?.role === "client",
  });

  const trainerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (trainersQuery.data ?? []).forEach((t) => {
      map.set(t.id, t.profiles?.full_name ?? "Trainer");
    });
    return map;
  }, [trainersQuery.data]);

  const conversationLabel = useCallback(
    (c: Conversation) => {
      if (user?.role === "client") {
        return trainerNameById.get(c.trainer_id) ?? "Trainer";
      }
      return c.client_profile?.full_name?.trim() || "Client";
    },
    [trainerNameById, user?.role],
  );

  const conversations = conversationsQuery.data ?? [];
  const activeConversations = useMemo(() => conversations.filter((c) => c.chat_open !== false), [conversations]);
  const archivedConversations = useMemo(() => conversations.filter((c) => c.chat_open === false), [conversations]);

  const sections = useMemo(() => {
    const out: { title: string; data: Conversation[] }[] = [];
    if (activeConversations.length) out.push({ title: "Live", data: activeConversations });
    if (archivedConversations.length) out.push({ title: "Archived", data: archivedConversations });
    return out;
  }, [activeConversations, archivedConversations]);

  function openThread(item: Conversation) {
    navigation.navigate("ChatThread", { conversationId: item.id });
  }

  return (
    <ScreenGradient>
      <View style={styles.shell}>
        <Text style={[vf.lead, { marginBottom: 14 }]}>
          Tap a conversation to open the chat. Live threads let you send messages; archived ones are read-only.
        </Text>

        {conversationsQuery.isLoading ? (
          <Text style={vf.muted}>Loading conversations...</Text>
        ) : conversations.length === 0 ? (
          <View style={vf.card}>
            <Text style={vf.cardTitle}>No conversations yet</Text>
            <Text style={vf.muted}>
              Chats unlock after payment is completed for a booking and close once the service is marked complete.
            </Text>
          </View>
        ) : sections.length === 0 ? (
          <Text style={vf.muted}>No threads to show.</Text>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={styles.sectionHeading}>{title}</Text>
            )}
            stickySectionHeadersEnabled={false}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.convRow, item.chat_open === false ? styles.convRowArchived : null]}
                onPress={() => openThread(item)}
              >
                <View style={styles.convRowMain}>
                  <Text style={styles.convName} numberOfLines={1}>
                    {conversationLabel(item)}
                  </Text>
                  <Text style={styles.convHint}>{item.chat_open === false ? "Read-only archive" : "Open chat"}</Text>
                </View>
                <Text style={[styles.livePill, item.chat_open === false ? styles.archivePill : styles.livePillOn]}>
                  {item.chat_open === false ? "Archived" : "Live"}
                </Text>
              </Pressable>
            )}
            SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListFooterComponent={
              !realtimeClient ? (
                <Text style={[vf.muted, { marginTop: 18 }]}>
                  Realtime refresh is off until EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.
                </Text>
              ) : null
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 },
  listContent: { paddingBottom: 32 },

  sectionHeading: {
    fontFamily: Font.outfitSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },

  convRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(16, 21, 36, 0.88)",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  convRowArchived: { opacity: 0.92 },
  convRowMain: { flex: 1, minWidth: 0 },
  convName: {
    fontSize: 16,
    fontFamily: Font.outfitSemiBold,
    color: colors.textPrimary,
  },
  convHint: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: Font.outfitRegular,
    color: colors.textMuted,
  },
  livePill: {
    fontSize: 10,
    fontFamily: Font.outfitBold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  livePillOn: {
    color: colors.successBright,
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  archivePill: {
    color: colors.textMuted,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});
