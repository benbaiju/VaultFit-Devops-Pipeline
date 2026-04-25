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

export function MessagesPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialConversationId = searchParams.get("conversationId") ?? "";

  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);

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
  const selectedConversationLabel = selectedConversation
    ? conversationLabel(selectedConversation.id)
    : selectedConversationId
      ? "Conversation"
      : "Conversation";

  return (
    <section>
      <h2>Messages</h2>
      <div className="chat-layout">
        <aside className="card chat-sidebar">
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
                    <span className="chat-conversation-meta">live</span>
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

        <section className="card chat-thread">
          {!selectedConversationId ? (
            <p className="muted">Select a conversation to start messaging.</p>
          ) : (
            <>
              <div className="chat-thread-head">
                <h3>{selectedConversationLabel}</h3>
                <p className="muted">{selectedConversation?.chat_open === false ? "Archived thread" : "Live thread"}</p>
              </div>

              {messagesQuery.isError ? <p className="error">{(messagesQuery.error as Error).message}</p> : null}
              {selectedConversation?.chat_open === false ? (
                <p className="muted">Service completed. This chat is archived and read-only.</p>
              ) : null}

              <div className="chat-messages">
                {messages.length === 0 ? <p className="muted">No messages yet. Say hello.</p> : null}
                {messages.map((message) => {
                  const mine = message.sender_id === user?.id;
                  const imageUrl = message.image_signed_url ?? message.image_url ?? null;
                  const isImage = message.message_type === "image" && Boolean(imageUrl);
                  return (
                    <div key={message.id} className={`chat-message-row ${mine ? "chat-message-row-mine" : ""}`}>
                      <div className={`chat-bubble ${mine ? "chat-bubble-mine" : ""}`}>
                        {isImage ? (
                          <a href={imageUrl!} target="_blank" rel="noreferrer">
                            <img src={imageUrl!} alt="Chat upload" className="chat-image" />
                          </a>
                        ) : (
                          <p>{message.message}</p>
                        )}
                        <span>{new Date(message.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="chat-composer">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message..." />
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
        .chat-image {
          max-width: 220px;
          max-height: 220px;
          border-radius: 0.6rem;
          display: block;
          border: 1px solid var(--border-light);
        }
      `}</style>

      {error ? <p className="error">{error}</p> : null}
      {!realtimeClient ? <p className="muted">Realtime disabled: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p> : null}
    </section>
  );
}
