import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { realtimeClient } from "../lib/supabase-realtime";
import {
  getConversations,
  getMessages,
  markConversationRead,
  sendMessage,
  sendImageMessage,
} from "../services/messaging";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

type CallSignalPayload = {
  fromUserId: string;
  toUserId?: string;
  conversationId: string;
  callId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  reason?: string;
};

const FREE_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const CALL_STARTED_TEXT = "Video call started";
const CALL_DECLINED_TEXT = "Video call declined";
const CALL_ENDED_PREFIX = "Video call ended";

function normalizeCallEventText(raw: string): string {
  return raw
    .replace(/^\[(Video call[^\]]*)\]$/i, "$1")
    .replace(/^\[(Video call[^\]]*)\]\s*/i, "$1 ")
    .trim();
}

export function MessagesPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialConversationId = searchParams.get("conversationId") ?? "";

  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const signalingChannelRef = useRef<ReturnType<NonNullable<typeof realtimeClient>["channel"]> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const callConnectedAtRef = useRef<number | null>(null);

  const [callId, setCallId] = useState("");
  const [incomingFromUserId, setIncomingFromUserId] = useState("");
  const [incomingOfferPending, setIncomingOfferPending] = useState(false);
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "incoming" | "connecting" | "connected" | "ended">("idle");
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isCallChannelReady, setIsCallChannelReady] = useState(false);
  const [callChannelStatus, setCallChannelStatus] = useState("idle");
  const [needsRemotePlaybackAction, setNeedsRemotePlaybackAction] = useState(false);

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(token, true),
  });

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", selectedConversationId],
    queryFn: () => getMessages(token, selectedConversationId),
    enabled: Boolean(selectedConversationId),
  });

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
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    void markConversationRead(token, selectedConversationId);
  }, [selectedConversationId, token]);

  useEffect(() => {
    if (!selectedConversationId && (conversationsQuery.data ?? []).length > 0) {
      const active = conversationsQuery.data!.find((c) => c.chat_open !== false);
      setSelectedConversationId((active ?? conversationsQuery.data![0]).id);
    }
  }, [conversationsQuery.data, selectedConversationId]);

  useEffect(() => {
    if (initialConversationId) {
      setSelectedConversationId(initialConversationId);
    }
  }, [initialConversationId]);

  const sendMessageMutation = useMutation({
    mutationFn: () => sendMessage(token, selectedConversationId, draft),
    onSuccess: () => {
      setError("");
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const sendImageMutation = useMutation({
    mutationFn: (file: File) => sendImageMessage(token, selectedConversationId, file),
    onSuccess: () => {
      setError("");
      if (imageInputRef.current) imageInputRef.current.value = "";
      void queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const trainers = trainersQuery.data ?? [];
  const conversations = conversationsQuery.data ?? [];
  const activeConversations = conversations.filter((c) => c.chat_open !== false);
  const archivedConversations = conversations.filter((c) => c.chat_open === false);
  const messages = messagesQuery.data ?? [];

  const trainerNameById = useMemo(() => {
    const map = new Map<string, string>();
    trainers.forEach((trainer) => {
      map.set(trainer.id, trainer.profiles?.full_name ?? "Trainer");
    });
    return map;
  }, [trainers]);
  const trainerUserIdByTrainerId = useMemo(() => {
    const map = new Map<string, string>();
    trainers.forEach((trainer) => {
      if (trainer.user_id) map.set(trainer.id, trainer.user_id);
    });
    return map;
  }, [trainers]);

  function conversationLabel(conversationId: string): string {
    const conversation = conversations.find((c) => c.id === conversationId);
    if (!conversation) return "Conversation";
    if (user?.role === "client") {
      return trainerNameById.get(conversation.trainer_id) ?? "Trainer";
    }
    return "Client";
  }

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId),
    [conversations, selectedConversationId],
  );
  const selectedPeerUserId = useMemo(() => {
    if (!selectedConversation || !user?.id) return "";
    if (selectedConversation.client_id === user.id) {
      return trainerUserIdByTrainerId.get(selectedConversation.trainer_id) ?? "";
    }
    return selectedConversation.client_id;
  }, [selectedConversation, trainerUserIdByTrainerId, user?.id]);

  useEffect(() => {
    return () => {
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
      pendingOfferRef.current = null;
      pendingIceCandidatesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!selectedConversationId || !realtimeClient || !user?.id) return;
    const client = realtimeClient;
    setIsCallChannelReady(false);
    setCallChannelStatus("connecting");

    const callChannel = client
      .channel(`call-signaling-${selectedConversationId}`)
      .on("broadcast", { event: "call_offer" }, ({ payload }) => {
        const data = payload as CallSignalPayload;
        if (data.toUserId && data.toUserId !== user.id) return;
        if (data.fromUserId === user.id) return;
        pendingOfferRef.current = data.offer ?? null;
        setCallId(data.callId);
        setIncomingFromUserId(data.fromUserId);
        setIncomingOfferPending(Boolean(data.offer));
        setCallStatus("incoming");
      })
      .on("broadcast", { event: "call_answer" }, async ({ payload }) => {
        const data = payload as CallSignalPayload;
        if (data.toUserId && data.toUserId !== user.id) return;
        if (!peerConnectionRef.current || !data.answer) return;
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        if (pendingIceCandidatesRef.current.length > 0) {
          for (const candidate of pendingIceCandidatesRef.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingIceCandidatesRef.current = [];
        }
        setCallStatus("connected");
      })
      .on("broadcast", { event: "ice_candidate" }, async ({ payload }) => {
        const data = payload as CallSignalPayload;
        if (data.toUserId && data.toUserId !== user.id) return;
        if (!peerConnectionRef.current || !data.candidate) return;
        if (!peerConnectionRef.current.remoteDescription) {
          pendingIceCandidatesRef.current.push(data.candidate);
          return;
        }
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          // ignore stale/invalid candidate
        }
      })
      .on("broadcast", { event: "call_end" }, ({ payload }) => {
        const data = payload as CallSignalPayload;
        if (data.toUserId && data.toUserId !== user.id) return;
        endCall({ notifyPeer: false, setEnded: true });
      })
      .subscribe((status) => {
        setCallChannelStatus(status.toLowerCase());
        setIsCallChannelReady(status === "SUBSCRIBED");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setError(`Call signaling unavailable (${status}). You can still send messages.`);
        }
      });

    signalingChannelRef.current = callChannel;

    return () => {
      void client.removeChannel(callChannel);
      signalingChannelRef.current = null;
      setIsCallChannelReady(false);
      setCallChannelStatus("idle");
    };
  }, [selectedConversationId, user?.id]);

  async function ensureLocalStream(): Promise<MediaStream> {
    if (!window.isSecureContext) {
      throw new Error("Video calls require HTTPS on mobile. Open the app using a secure (https://) URL.");
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      throw new Error("Camera/microphone API is unavailable in this browser context. Use Chrome/Safari on a secure URL.");
    }
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = stream;
    setIsMicEnabled(true);
    setIsCameraEnabled(true);
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }

  function formatCallDuration(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  async function postCallEventMessage(message: string): Promise<void> {
    if (!selectedConversationId) return;
    try {
      await sendMessage(token, selectedConversationId, message);
      void queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      // Timeline logging should not break live call flow.
    }
  }

  async function tryPlayRemoteVideo(): Promise<void> {
    const el = remoteVideoRef.current;
    if (!el) return;
    try {
      await el.play();
      setNeedsRemotePlaybackAction(false);
    } catch {
      setNeedsRemotePlaybackAction(true);
    }
  }

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.onloadedmetadata = () => {
        void tryPlayRemoteVideo();
      };
      void tryPlayRemoteVideo();
    }
  }, [callStatus]);

  function buildPeerConnection(targetUserId: string, activeCallId: string): RTCPeerConnection {
    const peer = new RTCPeerConnection({ iceServers: FREE_ICE_SERVERS });
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.onloadedmetadata = () => {
        void tryPlayRemoteVideo();
      };
    }

    peer.ontrack = (event) => {
      if (event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
      } else {
        remoteStream.addTrack(event.track);
      }
      void tryPlayRemoteVideo();
    };
    peer.onicecandidate = (event) => {
      if (!event.candidate || !signalingChannelRef.current || !user?.id || !selectedConversationId) return;
      void signalingChannelRef.current.send({
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
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        if (!callConnectedAtRef.current) callConnectedAtRef.current = Date.now();
        setCallStatus("connected");
      } else if (peer.connectionState === "failed" || peer.connectionState === "disconnected" || peer.connectionState === "closed") {
        setCallStatus("ended");
      }
    };
    return peer;
  }

  function endCall(opts?: { notifyPeer?: boolean; setEnded?: boolean }) {
    const { notifyPeer = true, setEnded = false } = opts ?? {};
    if (notifyPeer && signalingChannelRef.current && user?.id && selectedConversationId && selectedPeerUserId && callId) {
      void signalingChannelRef.current.send({
        type: "broadcast",
        event: "call_end",
        payload: {
          fromUserId: user.id,
          toUserId: selectedPeerUserId,
          conversationId: selectedConversationId,
          callId,
        } satisfies CallSignalPayload,
      });
    }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
    remoteStreamRef.current = null;
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    callConnectedAtRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.onloadedmetadata = null;
    }
    setIncomingOfferPending(false);
    setIncomingFromUserId("");
    setCallId("");
    setCallStatus(setEnded ? "ended" : "idle");
    setNeedsRemotePlaybackAction(false);
  }

  async function startCall() {
    if (!selectedConversationId) {
      setError("Please select a conversation first.");
      return;
    }
    if (!selectedPeerUserId) {
      setError("Unable to identify the other participant for this chat.");
      return;
    }
    if (!user?.id) {
      setError("You must be signed in to start a call.");
      return;
    }
    if (!signalingChannelRef.current) {
      setError("Call signaling is not initialized yet. Please wait and try again.");
      return;
    }
    try {
      setError("");
      setCallStatus("calling");
      const localStream = await ensureLocalStream();
      const nextCallId = `${selectedConversationId}-${Date.now()}`;
      setCallId(nextCallId);
      const peer = buildPeerConnection(selectedPeerUserId, nextCallId);
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      peerConnectionRef.current = peer;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await signalingChannelRef.current.send({
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
      void postCallEventMessage(CALL_STARTED_TEXT);
      setCallStatus("connecting");
    } catch (e) {
      endCall({ notifyPeer: false });
      setError((e as Error).message || "Unable to start video call");
    }
  }

  async function acceptIncomingCall() {
    if (
      !pendingOfferRef.current ||
      !selectedConversationId ||
      !incomingFromUserId ||
      !signalingChannelRef.current ||
      !user?.id ||
      !callId
    ) {
      return;
    }
    try {
      setError("");
      const localStream = await ensureLocalStream();
      const peer = buildPeerConnection(incomingFromUserId, callId);
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      peerConnectionRef.current = peer;
      await peer.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await signalingChannelRef.current.send({
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
      pendingOfferRef.current = null;
      if (pendingIceCandidatesRef.current.length > 0) {
        for (const candidate of pendingIceCandidatesRef.current) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingIceCandidatesRef.current = [];
      }
      setIncomingOfferPending(false);
      setIncomingFromUserId("");
      setCallStatus("connecting");
    } catch (e) {
      endCall({ notifyPeer: false });
      setError((e as Error).message || "Unable to accept incoming call");
    }
  }

  function rejectIncomingCall() {
    if (!signalingChannelRef.current || !incomingFromUserId || !user?.id || !selectedConversationId || !callId) {
      setIncomingOfferPending(false);
      setIncomingFromUserId("");
      setCallStatus("idle");
      return;
    }
    void signalingChannelRef.current.send({
      type: "broadcast",
      event: "call_end",
      payload: {
        fromUserId: user.id,
        toUserId: incomingFromUserId,
        conversationId: selectedConversationId,
        callId,
        reason: "rejected",
      } satisfies CallSignalPayload,
    });
    void postCallEventMessage(CALL_DECLINED_TEXT);
    setIncomingOfferPending(false);
    setIncomingFromUserId("");
    pendingOfferRef.current = null;
    setCallStatus("idle");
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextEnabled = !isMicEnabled;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsMicEnabled(nextEnabled);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextEnabled = !isCameraEnabled;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsCameraEnabled(nextEnabled);
  }

  function endCallAndLog() {
    const connectedAt = callConnectedAtRef.current;
    endCall({ notifyPeer: true, setEnded: true });
    if (!connectedAt) {
      void postCallEventMessage(CALL_ENDED_PREFIX);
      return;
    }
    const durationSeconds = Math.max(0, Math.round((Date.now() - connectedAt) / 1000));
    void postCallEventMessage(`${CALL_ENDED_PREFIX} • Duration ${formatCallDuration(durationSeconds)}`);
  }

  const selectedConversationLabel = selectedConversation
    ? conversationLabel(selectedConversation.id)
    : selectedConversationId
      ? "Conversation"
      : "Conversation";

  return (
    <section>
      <h2>Messages</h2>
      <div className="chat-layout">
        <aside className="card chat-sidebar whatsapp-rail">
          <div className="chat-conversations">
            <h3>Conversations</h3>
            {conversationsQuery.isLoading ? <p className="muted">Loading conversations...</p> : null}
            {!conversationsQuery.isLoading && conversations.length === 0 ? (
              <p className="muted">
                No active chats yet. Chats unlock only after payment is completed and close once the service is completed.
              </p>
            ) : null}
            <div className="chat-conversation-list">
              {activeConversations.map((conversation) => {
                const active = conversation.id === selectedConversationId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`chat-conversation-item ${active ? "chat-conversation-item-active" : ""}`}
                    onClick={() => setSelectedConversationId(conversation.id)}
                  >
                    <span className="chat-conversation-name">{conversationLabel(conversation.id)}</span>
                    <span className="chat-conversation-meta chat-conversation-meta-live">live</span>
                  </button>
                );
              })}
            </div>
            {archivedConversations.length > 0 ? (
              <>
                <p className="booking-section-title">Archived (read-only)</p>
                <div className="chat-conversation-list">
                  {archivedConversations.map((conversation) => {
                    const active = conversation.id === selectedConversationId;
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        className={`chat-conversation-item ${active ? "chat-conversation-item-active" : ""}`}
                        onClick={() => setSelectedConversationId(conversation.id)}
                      >
                        <span className="chat-conversation-name">{conversationLabel(conversation.id)}</span>
                        <span className="chat-conversation-meta">archived</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        </aside>

        <section className="card chat-thread whatsapp-thread">
          {!selectedConversationId ? (
            <p className="muted">Select a conversation to start messaging.</p>
          ) : (
            <>
              <div className="chat-thread-head whatsapp-thread-head">
                <h3>{selectedConversationLabel}</h3>
                <div className="chat-head-actions">
                  <p className="muted">{selectedConversation?.chat_open === false ? "Archived thread" : "Live thread"}</p>
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={
                      selectedConversation?.chat_open === false ||
                      !selectedPeerUserId ||
                      callStatus === "calling" ||
                      callStatus === "connecting" ||
                      callStatus === "connected"
                    }
                    onClick={() => {
                      void startCall();
                    }}
                  >
                    Video Call
                  </button>
                </div>
              </div>
              {!isCallChannelReady ? (
                <p className="muted call-status-hint">
                  Video signaling status: {callChannelStatus}. If this stays stuck, verify Supabase Realtime is enabled for your project.
                </p>
              ) : null}
              {incomingOfferPending ? (
                <div className="call-banner">
                  <p>Incoming video call...</p>
                  <div className="call-banner-actions">
                    <button type="button" className="primary-btn" onClick={() => void acceptIncomingCall()}>
                      Accept
                    </button>
                    <button type="button" className="secondary-btn" onClick={rejectIncomingCall}>
                      Decline
                    </button>
                  </div>
                </div>
              ) : null}

              {callStatus === "calling" || callStatus === "connecting" || callStatus === "connected" ? (
                <div className="call-panel">
                  <div className="call-videos">
                    <div className="call-video-card">
                      <p>You</p>
                      <video ref={localVideoRef} autoPlay muted playsInline />
                    </div>
                    <div className="call-video-card">
                      <p>{selectedConversationLabel}</p>
                      <video ref={remoteVideoRef} autoPlay playsInline />
                    </div>
                  </div>
                  <div className="call-actions">
                    <span className="muted">Call status: {callStatus}</span>
                    <button type="button" className="secondary-btn" onClick={() => void tryPlayRemoteVideo()}>
                      Refresh Remote Video
                    </button>
                    {needsRemotePlaybackAction ? (
                      <button type="button" className="secondary-btn" onClick={() => void tryPlayRemoteVideo()}>
                        Tap to start remote video/audio
                      </button>
                    ) : null}
                    <button type="button" className="secondary-btn" onClick={toggleMic}>
                      {isMicEnabled ? "Mute" : "Unmute"}
                    </button>
                    <button type="button" className="secondary-btn" onClick={toggleCamera}>
                      {isCameraEnabled ? "Camera Off" : "Camera On"}
                    </button>
                    <button type="button" className="primary-btn" onClick={endCallAndLog}>
                      End Call
                    </button>
                  </div>
                </div>
              ) : null}

              {messagesQuery.isError ? <p className="error">{(messagesQuery.error as Error).message}</p> : null}
              {selectedConversation?.chat_open === false ? (
                <p className="muted">Service completed. This chat is archived and read-only.</p>
              ) : null}

              <div className="chat-messages whatsapp-messages">
                {messages.length === 0 ? <p className="muted">No messages yet. Say hello.</p> : null}
                {messages.map((message) => {
                  const mine = message.sender_id === user?.id;
                  const imageUrl = message.image_signed_url ?? message.image_url ?? null;
                  const isImage = message.message_type === "image" && Boolean(imageUrl);
                  const normalizedMessageText = normalizeCallEventText(message.message);
                  const isCallEvent =
                    normalizedMessageText === CALL_STARTED_TEXT ||
                    normalizedMessageText === CALL_DECLINED_TEXT ||
                    normalizedMessageText.startsWith(CALL_ENDED_PREFIX);
                  return (
                    <div
                      key={message.id}
                      className={`chat-message-row ${mine ? "chat-message-row-mine" : ""} ${isCallEvent ? "chat-message-row-system" : ""}`}
                    >
                      <div className={`chat-bubble ${mine ? "chat-bubble-mine" : ""} ${isImage ? "chat-bubble-image" : ""}`}>
                        {isCallEvent ? (
                          <p className="chat-system-message">{normalizedMessageText}</p>
                        ) : isImage ? (
                          <a href={imageUrl!} target="_blank" rel="noreferrer">
                            <img src={imageUrl!} alt="Chat upload" className="chat-image" />
                          </a>
                        ) : (
                          <p>{message.message}</p>
                        )}
                        <span className={`chat-time ${isCallEvent ? "chat-time-system" : ""}`}>
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="chat-composer whatsapp-composer">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file || selectedConversation?.chat_open === false) return;
                    void sendImageMutation.mutate(file);
                  }}
                />
                <button
                  className="secondary-btn"
                  type="button"
                  disabled={sendImageMutation.isPending || selectedConversation?.chat_open === false || messagesQuery.isError}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {sendImageMutation.isPending ? "Uploading..." : "Image"}
                </button>
                <button
                  className="primary-btn"
                  disabled={
                    !draft.trim() ||
                    sendMessageMutation.isPending ||
                    messagesQuery.isError ||
                    selectedConversation?.chat_open === false
                  }
                  onClick={() => sendMessageMutation.mutate()}
                >
                  {sendMessageMutation.isPending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <style>{`
        .chat-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 1rem;
          min-height: 70vh;
        }
        .whatsapp-rail,
        .whatsapp-thread {
          margin-bottom: 0;
          display: flex;
          flex-direction: column;
          padding: 0;
          overflow: hidden;
        }
        .chat-conversations {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 1rem;
          gap: 0.75rem;
        }
        .chat-conversations h3 {
          margin: 0;
          padding: 0 0.25rem;
        }
        .chat-conversation-list {
          display: grid;
          gap: 0.45rem;
          overflow-y: auto;
          padding-right: 0.2rem;
        }
        .chat-conversation-item {
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-primary);
          border-radius: 0.9rem;
          padding: 0.75rem 0.85rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          text-align: left;
          width: 100%;
        }
        .chat-conversation-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .chat-conversation-item-active {
          border-color: rgba(99, 102, 241, 0.6);
          background: rgba(79, 70, 229, 0.18);
        }
        .chat-conversation-name {
          font-weight: 700;
          font-size: 0.95rem;
        }
        .chat-conversation-meta {
          font-size: 0.72rem;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 0.04em;
        }
        .chat-conversation-meta-live {
          color: #34d399;
        }
        .whatsapp-thread-head {
          padding: 0.95rem 1rem;
          border-bottom: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
        }
        .chat-head-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .whatsapp-thread-head h3 {
          margin: 0;
        }
        .call-banner {
          margin: 0.75rem 1rem 0;
          border: 1px solid rgba(59, 130, 246, 0.4);
          background: rgba(37, 99, 235, 0.15);
          border-radius: 0.8rem;
          padding: 0.7rem 0.9rem;
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
        }
        .call-banner p {
          margin: 0;
        }
        .call-banner-actions {
          display: flex;
          gap: 0.5rem;
        }
        .call-panel {
          margin: 0.75rem 1rem 0;
          border: 1px solid var(--border-light);
          border-radius: 0.8rem;
          background: rgba(2, 6, 23, 0.55);
          padding: 0.8rem;
          display: grid;
          gap: 0.7rem;
        }
        .call-status-hint {
          margin: 0.55rem 1rem 0;
          font-size: 0.78rem;
        }
        .call-videos {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.7rem;
        }
        .call-video-card {
          border: 1px solid var(--border-light);
          border-radius: 0.7rem;
          overflow: hidden;
          background: rgba(2, 6, 23, 0.6);
        }
        .call-video-card p {
          margin: 0;
          padding: 0.35rem 0.55rem;
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .call-video-card video {
          width: 100%;
          min-height: 180px;
          background: #020617;
          object-fit: cover;
          display: block;
        }
        .call-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          align-items: center;
        }
        .whatsapp-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background-image: radial-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px);
          background-size: 16px 16px;
          background-color: rgba(2, 6, 23, 0.28);
        }
        .chat-message-row {
          display: flex;
          justify-content: flex-start;
        }
        .chat-message-row-mine {
          justify-content: flex-end;
        }
        .chat-message-row-system {
          justify-content: center;
        }
        .chat-bubble {
          max-width: min(78%, 520px);
          border-radius: 1rem;
          border: 1px solid var(--border-light);
          background: rgba(15, 23, 42, 0.9);
          padding: 0.58rem 0.72rem 0.42rem;
        }
        .chat-bubble p {
          margin: 0;
          line-height: 1.45;
          word-break: break-word;
        }
        .chat-bubble-mine {
          background: rgba(37, 99, 235, 0.2);
          border-color: rgba(59, 130, 246, 0.35);
        }
        .chat-system-message {
          margin: 0;
          font-style: italic;
          color: var(--text-muted);
          text-align: center;
        }
        .chat-message-row-system .chat-bubble {
          background: transparent;
          border: none;
          padding: 0.2rem 0.35rem 0.1rem;
          max-width: 90%;
        }
        .chat-bubble-image {
          padding: 0.42rem;
        }
        .chat-time {
          display: block;
          margin-top: 0.3rem;
          font-size: 0.7rem;
          color: var(--text-muted);
          text-align: right;
        }
        .chat-time-system {
          text-align: center;
          margin-top: 0.18rem;
        }
        .whatsapp-composer {
          border-top: 1px solid var(--border-light);
          padding: 0.8rem;
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 0.6rem;
          align-items: center;
          background: rgba(2, 6, 23, 0.88);
        }
        .whatsapp-composer input {
          margin: 0;
          min-height: 42px;
          border-radius: 999px;
          padding-left: 0.95rem;
        }
        .whatsapp-composer .secondary-btn,
        .whatsapp-composer .primary-btn {
          margin: 0;
          min-height: 42px;
          border-radius: 999px;
          padding: 0 1rem;
        }
        .chat-image {
          max-width: 220px;
          max-height: 220px;
          border-radius: 0.6rem;
          display: block;
          border: 1px solid var(--border-light);
        }
        @media (max-width: 980px) {
          .chat-layout {
            grid-template-columns: 1fr;
          }
          .whatsapp-rail {
            min-height: 220px;
            max-height: 300px;
          }
          .call-videos {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {error ? <p className="error">{error}</p> : null}
      {!realtimeClient ? <p className="muted">Realtime disabled: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p> : null}
    </section>
  );
}
