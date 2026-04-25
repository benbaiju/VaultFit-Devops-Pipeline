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
                <p className="muted">{selectedConversation?.chat_open === false ? "Archived thread" : "Live thread"}</p>
              </div>

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
                  return (
                    <div key={message.id} className={`chat-message-row ${mine ? "chat-message-row-mine" : ""}`}>
                      <div className={`chat-bubble ${mine ? "chat-bubble-mine" : ""} ${isImage ? "chat-bubble-image" : ""}`}>
                        {isImage ? (
                          <a href={imageUrl!} target="_blank" rel="noreferrer">
                            <img src={imageUrl!} alt="Chat upload" className="chat-image" />
                          </a>
                        ) : (
                          <p>{message.message}</p>
                        )}
                        <span className="chat-time">{new Date(message.created_at).toLocaleString()}</span>
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
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
        }
        .whatsapp-thread-head h3 {
          margin: 0;
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
        }
      `}</style>

      {error ? <p className="error">{error}</p> : null}
      {!realtimeClient ? <p className="muted">Realtime disabled: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p> : null}
    </section>
  );
}
