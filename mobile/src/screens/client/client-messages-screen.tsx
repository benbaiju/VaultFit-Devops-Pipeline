import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { realtimeClient } from "../../lib/supabase-realtime";
import { getConversations, getMessages, sendMessage } from "../../services/messaging";
import { useAuth } from "../../state/auth-context";
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCView } from "react-native-webrtc";

type CallSignalPayload = {
  fromUserId: string;
  toUserId?: string;
  conversationId: string;
  callId: string;
  offer?: any;
  answer?: any;
  candidate?: any;
};

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const CALL_EVENT_MESSAGES = new Set(["Video call started", "Video call declined", "Video call ended"]);

export function ClientMessagesScreen() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [draft, setDraft] = useState("");
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "incoming" | "connecting" | "connected">("idle");
  const [incomingOffer, setIncomingOffer] = useState<any | null>(null);
  const [incomingFromUserId, setIncomingFromUserId] = useState("");
  const [callId, setCallId] = useState("");
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [localStreamUrl, setLocalStreamUrl] = useState("");
  const [remoteStreamUrl, setRemoteStreamUrl] = useState("");
  const [peer, setPeer] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<any>(null);
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

  const conversations = conversationsQuery.data ?? [];
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );
  const selectedConversationLabel = useMemo(() => {
    if (!selectedConversation) return "Conversation";
    return selectedConversation.client_profile?.full_name || "Conversation";
  }, [selectedConversation]);
  const selectedPeerUserId = useMemo(() => {
    if (!selectedConversation || !user?.id) return "";
    return selectedConversation.client_id === user.id ? selectedConversation.trainer_id : selectedConversation.client_id;
  }, [selectedConversation, user?.id]);

  async function ensureLocalStream(): Promise<any> {
    if (localStream) return localStream;
    const stream = await mediaDevices.getUserMedia({ audio: true, video: true });
    setLocalStream(stream);
    setLocalStreamUrl(stream.toURL());
    setIsMicEnabled(true);
    setIsCameraEnabled(true);
    return stream;
  }

  function createPeerConnection(targetUserId: string, activeCallId: string): RTCPeerConnection {
    const nextPeer: any = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const remoteStream: any = new (globalThis as any).MediaStream();
    nextPeer.ontrack = (event: any) => {
      if (event.streams?.[0]) {
        setRemoteStreamUrl(event.streams[0].toURL());
      } else {
        remoteStream.addTrack(event.track);
        setRemoteStreamUrl(remoteStream.toURL());
      }
    };
    nextPeer.onicecandidate = (event: any) => {
      if (!event.candidate || !realtimeClient || !selectedConversationId || !user?.id) return;
      const channel = realtimeClient.channel(`call-signaling-${selectedConversationId}`);
      void channel.send({
        type: "broadcast",
        event: "ice_candidate",
        payload: {
          fromUserId: user.id,
          toUserId: targetUserId,
          conversationId: selectedConversationId,
          callId: activeCallId,
          candidate: event.candidate.toJSON(),
        } satisfies CallSignalPayload,
      });
    };
    nextPeer.onconnectionstatechange = () => {
      if (nextPeer.connectionState === "connected") setCallStatus("connected");
    };
    return nextPeer;
  }

  function cleanupCall() {
    peer?.close();
    setPeer(null);
    localStream?.getTracks().forEach((track: any) => track.stop());
    setLocalStream(null);
    setLocalStreamUrl("");
    setRemoteStreamUrl("");
    setIncomingOffer(null);
    setIncomingFromUserId("");
    setCallStatus("idle");
    setCallId("");
  }

  async function postCallEventMessage(message: string) {
    if (!selectedConversationId) return;
    try {
      await sendMessage(token, selectedConversationId, message);
      void queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      // Non-blocking: call flow should continue even if log message fails.
    }
  }

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

  useEffect(() => {
    const client = realtimeClient;
    if (!selectedConversationId || !client) return;

    const channel = client
      .channel(`call-signaling-${selectedConversationId}`)
      .on("broadcast", { event: "call_offer" }, ({ payload }) => {
        const data = payload as CallSignalPayload;
        if (!user?.id || data.fromUserId === user.id) return;
        if (data.toUserId && data.toUserId !== user.id) return;
        setIncomingOffer(data.offer ?? null);
        setIncomingFromUserId(data.fromUserId);
        setCallStatus("incoming");
        setCallId(data.callId);
      })
      .on("broadcast", { event: "call_answer" }, async ({ payload }) => {
        const data = payload as CallSignalPayload;
        if (!peer || !data.answer || !user?.id) return;
        if (data.toUserId && data.toUserId !== user.id) return;
        await (peer as any).setRemoteDescription(new RTCSessionDescription(data.answer as any));
        setCallStatus("connected");
      })
      .on("broadcast", { event: "ice_candidate" }, async ({ payload }) => {
        const data = payload as CallSignalPayload;
        if (!peer || !data.candidate || !user?.id) return;
        if (data.toUserId && data.toUserId !== user.id) return;
        try {
          await (peer as any).addIceCandidate(new RTCIceCandidate(data.candidate as any));
        } catch {
          // Ignore stale candidate.
        }
      })
      .on("broadcast", { event: "call_end" }, ({ payload }) => {
        const data = payload as CallSignalPayload;
        if (!user?.id) return;
        if (data.toUserId && data.toUserId !== user.id) return;
        cleanupCall();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [peer, selectedConversationId, user?.id]);

  async function startCall() {
    if (!selectedConversationId || !selectedPeerUserId || !user?.id || !realtimeClient) return;
    try {
      setCallStatus("calling");
      const stream = await ensureLocalStream();
      const nextCallId = `${selectedConversationId}-${Date.now()}`;
      const nextPeer = createPeerConnection(selectedPeerUserId, nextCallId);
      stream.getTracks().forEach((track: any) => nextPeer.addTrack(track as any, stream as any));
      setPeer(nextPeer);
      setCallId(nextCallId);
      const offer = await nextPeer.createOffer();
      await nextPeer.setLocalDescription(offer);
      const channel = realtimeClient.channel(`call-signaling-${selectedConversationId}`);
      await channel.send({
        type: "broadcast",
        event: "call_offer",
        payload: {
          fromUserId: user.id,
          toUserId: selectedPeerUserId,
          conversationId: selectedConversationId,
          callId: nextCallId,
          offer,
        } satisfies CallSignalPayload,
      });
      await postCallEventMessage("Video call started");
      setCallStatus("connecting");
    } catch (e) {
      cleanupCall();
      Alert.alert("Call failed", (e as Error).message);
    }
  }

  async function acceptCall() {
    if (!incomingOffer || !incomingFromUserId || !selectedConversationId || !user?.id || !realtimeClient || !callId) return;
    try {
      const stream = await ensureLocalStream();
      const nextPeer = createPeerConnection(incomingFromUserId, callId);
      stream.getTracks().forEach((track: any) => nextPeer.addTrack(track as any, stream as any));
      setPeer(nextPeer);
      await (nextPeer as any).setRemoteDescription(new RTCSessionDescription(incomingOffer as any));
      const answer = await nextPeer.createAnswer();
      await nextPeer.setLocalDescription(answer);
      const channel = realtimeClient.channel(`call-signaling-${selectedConversationId}`);
      await channel.send({
        type: "broadcast",
        event: "call_answer",
        payload: {
          fromUserId: user.id,
          toUserId: incomingFromUserId,
          conversationId: selectedConversationId,
          callId,
          answer,
        } satisfies CallSignalPayload,
      });
      setIncomingOffer(null);
      setIncomingFromUserId("");
      setCallStatus("connecting");
    } catch (e) {
      cleanupCall();
      Alert.alert("Accept failed", (e as Error).message);
    }
  }

  function endCall() {
    const isIncomingDecline = callStatus === "incoming";
    const eventMessage = isIncomingDecline ? "Video call declined" : "Video call ended";
    if (!selectedConversationId || !realtimeClient || !user?.id || !callId) {
      cleanupCall();
      return;
    }
    const channel = realtimeClient.channel(`call-signaling-${selectedConversationId}`);
    void channel.send({
      type: "broadcast",
      event: "call_end",
      payload: {
        fromUserId: user.id,
        toUserId: selectedPeerUserId || incomingFromUserId,
        conversationId: selectedConversationId,
        callId,
      } satisfies CallSignalPayload,
    });
    void postCallEventMessage(eventMessage);
    cleanupCall();
  }

  function toggleMic() {
    if (!localStream) return;
    const nextEnabled = !isMicEnabled;
    localStream.getAudioTracks().forEach((track: any) => {
      track.enabled = nextEnabled;
    });
    setIsMicEnabled(nextEnabled);
  }

  function toggleCamera() {
    if (!localStream) return;
    const nextEnabled = !isCameraEnabled;
    localStream.getVideoTracks().forEach((track: any) => {
      track.enabled = nextEnabled;
    });
    setIsCameraEnabled(nextEnabled);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Messages</Text>
      <FlatList
        horizontal
        data={conversations}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        ListEmptyComponent={conversationsQuery.isLoading ? <Text style={styles.subtle}>Loading conversations...</Text> : <Text style={styles.subtle}>No conversations</Text>}
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
            <Pressable style={styles.callButton} onPress={() => void startCall()} disabled={callStatus !== "idle"}>
              <Text style={styles.callButtonText}>{callStatus === "idle" ? "Video Call" : callStatus}</Text>
            </Pressable>
          </View>
          {callStatus === "incoming" ? (
            <View style={styles.callBanner}>
              <Text style={styles.callBannerText}>Incoming video call</Text>
              <View style={styles.callBannerActions}>
                <Pressable style={styles.callActionBtn} onPress={() => void acceptCall()}>
                  <Text style={styles.callActionText}>Accept</Text>
                </Pressable>
                <Pressable style={styles.callActionBtn} onPress={endCall}>
                  <Text style={styles.callActionText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {callStatus === "calling" || callStatus === "connecting" || callStatus === "connected" ? (
            <View style={styles.callPanel}>
              {localStreamUrl ? <RTCView streamURL={localStreamUrl} style={styles.callVideo} objectFit="cover" mirror /> : null}
              {remoteStreamUrl ? <RTCView streamURL={remoteStreamUrl} style={styles.callVideo} objectFit="cover" /> : null}
              <View style={styles.callActions}>
                <Pressable style={styles.callActionBtn} onPress={toggleMic}>
                  <Text style={styles.callActionText}>{isMicEnabled ? "Mute" : "Unmute"}</Text>
                </Pressable>
                <Pressable style={styles.callActionBtn} onPress={toggleCamera}>
                  <Text style={styles.callActionText}>{isCameraEnabled ? "Camera Off" : "Camera On"}</Text>
                </Pressable>
                <Pressable style={styles.callActionBtn} onPress={endCall}>
                  <Text style={styles.callActionText}>End</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <FlatList
            data={messagesQuery.data ?? []}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={messagesQuery.isLoading ? <Text style={styles.subtle}>Loading messages...</Text> : <Text style={styles.subtle}>No messages yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.messageRow}>
                {CALL_EVENT_MESSAGES.has(item.message) ? (
                  <Text style={styles.callEventText}>{item.message}</Text>
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
            placeholderTextColor="#64748b"
          />
          <Pressable style={styles.sendButton} disabled={!draft.trim() || sendMutation.isPending} onPress={() => sendMutation.mutate()}>
            <Text style={styles.sendText}>{sendMutation.isPending ? "Sending..." : "Send"}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.subtle}>Select a conversation to view messages.</Text>
      )}
      {!realtimeClient ? <Text style={styles.subtle}>Realtime disabled: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", padding: 14 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtle: { color: "#94a3b8" },
  threadChip: { borderWidth: 1, borderColor: "#334155", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  threadChipActive: { borderColor: "#4f46e5", backgroundColor: "rgba(79,70,229,0.2)" },
  threadText: { color: "#cbd5e1" },
  chatCard: { flex: 1, marginTop: 10, backgroundColor: "#0f172a", borderRadius: 10, borderWidth: 1, borderColor: "#1e293b", padding: 10 },
  threadHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  threadTitle: { color: "#fff", fontWeight: "700", marginBottom: 8 },
  callButton: { borderWidth: 1, borderColor: "#4f46e5", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  callButtonText: { color: "#a5b4fc", fontWeight: "700" },
  callBanner: { borderWidth: 1, borderColor: "#4f46e5", borderRadius: 8, padding: 8, marginBottom: 8 },
  callBannerText: { color: "#c7d2fe", marginBottom: 8 },
  callBannerActions: { flexDirection: "row", gap: 8 },
  callPanel: { borderWidth: 1, borderColor: "#334155", borderRadius: 8, padding: 8, marginBottom: 8, gap: 8 },
  callVideo: { width: "100%", height: 180, borderRadius: 6, backgroundColor: "#020617" },
  callActions: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  callActionBtn: { flex: 1, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: "#4f46e5", paddingVertical: 8 },
  callActionText: { color: "#c7d2fe", fontWeight: "700" },
  messageRow: { borderBottomColor: "#1e293b", borderBottomWidth: 1, paddingVertical: 8 },
  messageText: { color: "#e2e8f0" },
  callEventText: { color: "#cbd5e1", fontStyle: "italic", textAlign: "center" },
  messageTime: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  input: { borderWidth: 1, borderColor: "#334155", borderRadius: 8, color: "#fff", paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  sendButton: { marginTop: 8, backgroundColor: "#4f46e5", borderRadius: 8, alignItems: "center", paddingVertical: 10 },
  sendText: { color: "#fff", fontWeight: "700" },
});
