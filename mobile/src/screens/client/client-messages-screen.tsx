import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { realtimeClient } from "../../lib/supabase-realtime";
import { getConversations, getMessages, sendImageMessage, sendMessage } from "../../services/messaging";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme";

const CALL_EVENT_MESSAGES = new Set(["Video call started", "Video call declined", "Video call ended"]);

export function ClientMessagesScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [draft, setDraft] = useState("");

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(token, true),
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", selectedConversationId],
    queryFn: () => getMessages(token, selectedConversationId),
    enabled: Boolean(selectedConversationId),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendMessage(token, selectedConversationId, draft.trim()),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e) => Alert.alert("Message failed", (e as Error).message),
  });

  const sendImageMutation = useMutation({
    mutationFn: (image: { uri: string; name?: string; type?: string }) => sendImageMessage(token, selectedConversationId, image),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e) => Alert.alert("Image failed", (e as Error).message),
  });

  const conversations = conversationsQuery.data ?? [];
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const selectedConversationLabel = useMemo(() => {
    if (!selectedConversation) return "Conversation";
    return selectedConversation.client_profile?.full_name || "Conversation";
  }, [selectedConversation]);

  useEffect(() => {
    const client = realtimeClient;
    if (!selectedConversationId || !client) return;
    const channel = client
      .channel(`messages-${selectedConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient, selectedConversationId]);

  async function pickAndSendImage() {
    if (!selectedConversationId || !selectedConversation || selectedConversation.chat_open === false) return;
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

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Messages</Text>
      <FlatList
        horizontal
        data={conversations}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        ListEmptyComponent={
          conversationsQuery.isLoading ? <Text style={styles.subtle}>Loading conversations...</Text> : <Text style={styles.subtle}>No conversations</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.threadChip, selectedConversationId === item.id ? styles.threadChipActive : null]}
            onPress={() => setSelectedConversationId(item.id)}
          >
            <Text style={styles.threadText}>{item.client_profile?.full_name ?? "Conversation"}</Text>
          </Pressable>
        )}
      />

      {selectedConversation ? (
        <View style={styles.chatCard}>
          <View style={styles.threadHeader}>
            <Text style={styles.threadTitle}>{selectedConversationLabel}</Text>
            <Text style={styles.callDisabledText}>Video call disabled in Expo Go</Text>
          </View>
          <FlatList
            data={messagesQuery.data ?? []}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={messagesQuery.isLoading ? <Text style={styles.subtle}>Loading messages...</Text> : <Text style={styles.subtle}>No messages yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.messageRow}>
                {CALL_EVENT_MESSAGES.has(item.message) ? (
                  <Text style={styles.callEventText}>{item.message}</Text>
                ) : item.message_type === "image" && (item.image_signed_url || item.image_url) ? (
                  <Pressable onPress={() => void Linking.openURL(item.image_signed_url ?? item.image_url ?? "")}>
                    <Image source={{ uri: item.image_signed_url ?? item.image_url ?? "" }} style={styles.messageImage} />
                  </Pressable>
                ) : (
                  <Text style={styles.messageText}>{item.message}</Text>
                )}
                <Text style={styles.messageTime}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
            )}
          />
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.composerRow}>
            <Pressable
              style={styles.imageButton}
              disabled={sendImageMutation.isPending || selectedConversation.chat_open === false}
              onPress={() => void pickAndSendImage()}
            >
              <Text style={styles.imageButtonText}>{sendImageMutation.isPending ? "Uploading..." : "Image"}</Text>
            </Pressable>
            <Pressable
              style={styles.sendButton}
              disabled={!draft.trim() || sendMutation.isPending || selectedConversation.chat_open === false}
              onPress={() => sendMutation.mutate()}
            >
              <Text style={styles.sendText}>{sendMutation.isPending ? "Sending..." : "Send"}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.subtle}>Select a conversation to view messages.</Text>
      )}
      {!realtimeClient ? <Text style={styles.subtle}>Realtime disabled: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 14 },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtle: { color: colors.textSecondary },
  threadChip: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  threadChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  threadText: { color: colors.textSection },
  chatCard: { flex: 1, marginTop: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, padding: 10 },
  threadHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  threadTitle: { color: colors.textPrimary, fontWeight: "700" },
  callDisabledText: { color: colors.textSecondary, fontSize: 12 },
  messageRow: { borderBottomColor: colors.borderStrong, borderBottomWidth: 1, paddingVertical: 8 },
  messageText: { color: colors.textBody },
  messageImage: { width: 180, height: 180, borderRadius: 8, backgroundColor: colors.bgDeep },
  callEventText: { color: colors.textSection, fontStyle: "italic", textAlign: "center" },
  messageTime: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  input: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 8, color: colors.textPrimary, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  composerRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  imageButton: { borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, backgroundColor: colors.chipBorder },
  imageButtonText: { color: colors.textPrimary, fontWeight: "700" },
  sendButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 8, alignItems: "center", paddingVertical: 10 },
  sendText: { color: colors.textPrimary, fontWeight: "700" },
});
