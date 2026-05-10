import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { realtimeClient } from "../../lib/supabase-realtime";
import { getConversations, getMessages, sendImageMessage, sendMessage } from "../../services/messaging";
import { getTrainers } from "../../services/trainers";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { Font } from "../../theme/fonts";
import type { Conversation, Message } from "../../types/api";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";
import type { MessagesStackParamList } from "./messaging-types";

const CALL_STARTED_TEXT = "Video call started";
const CALL_DECLINED_TEXT = "Video call declined";
const CALL_ENDED_PREFIX = "Video call ended";

function normalizeCallEventText(raw: string): string {
  return raw
    .replace(/^\[(Video call[^\]]*)\]$/i, "$1")
    .replace(/^\[(Video call[^\]]*)\]\s*/i, "$1 ")
    .trim();
}

function isCallEventMessage(messageText: string): boolean {
  const t = normalizeCallEventText(messageText);
  return t === CALL_STARTED_TEXT || t === CALL_DECLINED_TEXT || t.startsWith(CALL_ENDED_PREFIX);
}

type ChatRoute = RouteProp<MessagesStackParamList, "ChatThread">;

export function ClientChatThreadScreen() {
  const route = useRoute<ChatRoute>();
  const navigation = useNavigation();
  const conversationId = route.params.conversationId;
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<Message>>(null);
  const [draft, setDraft] = useState("");
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(token, true),
  });

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
    enabled: user?.role === "client",
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => getMessages(token, conversationId),
    enabled: Boolean(conversationId),
  });

  const trainerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (trainersQuery.data ?? []).forEach((t) => {
      map.set(t.id, t.profiles?.full_name ?? "Trainer");
    });
    return map;
  }, [trainersQuery.data]);

  const conversationLabelFn = useCallback(
    (c: Conversation) => {
      if (user?.role === "client") {
        return trainerNameById.get(c.trainer_id) ?? "Trainer";
      }
      return c.client_profile?.full_name?.trim() || "Client";
    },
    [trainerNameById, user?.role],
  );

  const conversation = useMemo(
    () => conversationsQuery.data?.find((c) => c.id === conversationId),
    [conversationsQuery.data, conversationId],
  );

  const title = conversation ? conversationLabelFn(conversation) : "Chat";

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMessage(token, conversationId, body),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e) => Alert.alert("Message failed", (e as Error).message),
  });

  const sendImageMutation = useMutation({
    mutationFn: (image: { uri: string; name?: string; type?: string }) => sendImageMessage(token, conversationId, image),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e) => Alert.alert("Image failed", (e as Error).message),
  });

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length, conversationId]);

  useEffect(() => {
    const client = realtimeClient;
    if (!conversationId || !client) return;
    const channel = client
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient, conversationId]);

  async function pickAndSendImage() {
    if (!conversation || conversation.chat_open === false) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo library access to send images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    sendImageMutation.mutate({
      uri: asset.uri,
      name: asset.fileName ?? "upload.jpg",
      type: asset.mimeType ?? "image/jpeg",
    });
  }

  function renderMessage({ item }: { item: Message }) {
    const mine = Boolean(user?.id && item.sender_id === user.id);
    const imageUrl = item.image_signed_url ?? item.image_url ?? null;
    const isImage = item.message_type === "image" && Boolean(imageUrl);
    const isCallEvent = isCallEventMessage(item.message);

    if (isCallEvent) {
      return (
        <View style={styles.systemRow}>
          <View style={styles.systemBubble}>
            <Text style={styles.systemText}>{normalizeCallEventText(item.message)}</Text>
            <Text style={styles.systemTime}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, isImage ? styles.bubbleImageWrap : null]}>
          {isImage ? (
            <Pressable onPress={() => void Linking.openURL(imageUrl!)}>
              <Image source={{ uri: imageUrl! }} style={styles.messageImage} resizeMode="cover" />
            </Pressable>
          ) : (
            <Text style={styles.bubbleText}>{item.message}</Text>
          )}
          <Text style={[styles.msgTime, mine ? styles.msgTimeMine : styles.msgTimeTheirs]}>{new Date(item.created_at).toLocaleString()}</Text>
        </View>
      </View>
    );
  }

  function onSendPress() {
    const body = draft.trim();
    if (!body || sendMutation.isPending) return;
    sendMutation.mutate(body);
  }

  if (!conversationId) {
    return null;
  }

  if (conversationsQuery.isLoading) {
    return (
      <ScreenGradient>
        <View style={[styles.flex, styles.centered]}>
          <Text style={vf.muted}>Loading conversation…</Text>
        </View>
      </ScreenGradient>
    );
  }

  if (!conversation) {
    return (
      <ScreenGradient>
        <View style={[styles.flex, styles.centered, { paddingHorizontal: 18 }]}>
          <View style={vf.card}>
            <Text style={vf.cardTitle}>Can't open this chat</Text>
            <Text style={vf.muted}>This conversation is not in your list. It may have been removed or access changed.</Text>
            <Pressable style={[vf.primaryBtn, { marginTop: 16 }]} onPress={() => navigation.goBack()}>
              <Text style={vf.btnLabel}>Back to messages</Text>
            </Pressable>
          </View>
        </View>
      </ScreenGradient>
    );
  }

  const chatLocked = conversation.chat_open === false;

  return (
    <ScreenGradient>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        <View style={[styles.flex, styles.inner]}>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{chatLocked ? "Archived — read-only" : "Live thread"}</Text>
            <Text style={styles.metaHint}>Video unavailable in Expo Go</Text>
          </View>

          {chatLocked ? (
            <View style={styles.lockedBanner}>
              <Text style={styles.lockedBannerText}>This booking chat is archived. You can read messages but cannot send new ones.</Text>
            </View>
          ) : null}

          <FlatList
            ref={listRef}
            style={styles.messagesPane}
            data={messages}
            keyExtractor={(item) => item.id}
            extraData={`${messages.length}:${user?.id}`}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={renderMessage}
            ListEmptyComponent={
              messagesQuery.isLoading ? (
                <Text style={vf.muted}>Loading messages...</Text>
              ) : (
                <Text style={vf.muted}>No messages yet. Say hello.</Text>
              )
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesContent}
          />

          <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={styles.composerInput}
              value={draft}
              onChangeText={setDraft}
              placeholder={chatLocked ? "Chat archived" : "Message…"}
              placeholderTextColor={colors.textMuted}
              editable={!chatLocked}
              multiline
              maxLength={4000}
              blurOnSubmit={false}
            />
            <Pressable
              style={[vf.secondaryBtn, styles.composerIconBtn]}
              disabled={sendImageMutation.isPending || chatLocked}
              onPress={() => void pickAndSendImage()}
              hitSlop={8}
            >
              <Text style={[vf.btnLabel, styles.photoBtnLabel]}>{sendImageMutation.isPending ? "…" : "Photo"}</Text>
            </Pressable>
            <Pressable
              style={[vf.primaryBtn, styles.sendRound]}
              disabled={!draft.trim() || sendMutation.isPending || chatLocked}
              onPress={onSendPress}
              hitSlop={8}
            >
              <Text style={[vf.btnLabel, styles.sendLabel]}>{sendMutation.isPending ? "…" : "Send"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenGradient>
  );
}

const BUBBLE_MAX = "82%" as const;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  inner: { paddingHorizontal: 12 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 8,
  },
  metaText: { fontSize: 13, fontFamily: Font.outfitMedium, color: colors.textSecondary },
  metaHint: { fontSize: 11, fontFamily: Font.outfitRegular, color: colors.textMuted, maxWidth: 120, textAlign: "right" },

  lockedBanner: {
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  lockedBannerText: { fontSize: 13, color: "#fde68a", fontFamily: Font.outfitMedium },

  messagesPane: {
    flex: 1,
    minHeight: 100,
    backgroundColor: "rgba(2, 6, 23, 0.35)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
  },

  msgRow: { flexDirection: "row", width: "100%", marginBottom: 6 },
  msgRowMine: { justifyContent: "flex-end" },
  msgRowTheirs: { justifyContent: "flex-start" },

  bubble: {
    maxWidth: BUBBLE_MAX,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 6,
  },
  bubbleTheirs: {
    borderColor: colors.borderLight,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    borderColor: "rgba(99, 102, 241, 0.4)",
    backgroundColor: "rgba(79, 70, 229, 0.24)",
    borderBottomRightRadius: 4,
  },
  bubbleImageWrap: { paddingHorizontal: 6, paddingVertical: 6 },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textBody,
    fontFamily: Font.outfitRegular,
  },
  msgTime: { fontSize: 10, marginTop: 4, fontFamily: Font.outfitRegular, color: colors.textMuted },
  msgTimeMine: { textAlign: "right" },
  msgTimeTheirs: { textAlign: "left" },

  messageImage: { width: 200, height: 200, borderRadius: 10, backgroundColor: colors.bgDeep },

  systemRow: { width: "100%", alignItems: "center", marginVertical: 4 },
  systemBubble: { maxWidth: "92%", paddingHorizontal: 6, paddingVertical: 4 },
  systemText: {
    fontSize: 13,
    fontStyle: "italic",
    color: colors.textMuted,
    textAlign: "center",
    fontFamily: Font.outfitRegular,
  },
  systemTime: { fontSize: 10, color: colors.textMuted, textAlign: "center", marginTop: 3, fontFamily: Font.outfitRegular },

  composerWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: "transparent",
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    color: colors.textPrimary,
    fontFamily: Font.outfitRegular,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    marginBottom: 0,
  },
  composerIconBtn: {
    paddingHorizontal: 14,
    minWidth: 56,
    marginBottom: 0,
    borderRadius: 22,
  },
  photoBtnLabel: { fontSize: 13 },
  sendRound: { marginBottom: 0, paddingHorizontal: 18, borderRadius: 22 },
  sendLabel: { fontSize: 14 },
});
