import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { realtimeClient } from "../lib/supabase-realtime";
import {
  createConversation,
  getConversations,
  getMessages,
  markConversationRead,
  sendMessage,
} from "../services/messaging";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

export function MessagesPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(token),
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
      setSelectedConversationId(conversationsQuery.data![0].id);
    }
  }, [conversationsQuery.data, selectedConversationId]);

  const createConversationMutation = useMutation({
    mutationFn: () => createConversation(token, selectedTrainerId),
    onSuccess: (conversation) => {
      setError("");
      setSelectedConversationId(conversation.id);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e) => setError((e as Error).message),
  });

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

  const trainers = trainersQuery.data ?? [];
  const conversations = conversationsQuery.data ?? [];
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
    return `Client ${conversation.client_id.slice(0, 8)}`;
  }

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  return (
    <section>
      <h2>Messages</h2>
      <div className="chat-layout">
        <aside className="card chat-sidebar">
          {user?.role === "client" ? (
            <div className="chat-start">
              <h3>Start chat</h3>
              <label>Trainer</label>
              <select value={selectedTrainerId} onChange={(e) => setSelectedTrainerId(e.target.value)}>
                <option value="">Select trainer</option>
                {trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.profiles?.full_name ?? trainer.id}
                  </option>
                ))}
              </select>
              <button
                className="primary-btn"
                disabled={!selectedTrainerId || createConversationMutation.isPending}
                onClick={() => createConversationMutation.mutate()}
              >
                {createConversationMutation.isPending ? "Starting..." : "Start chat"}
              </button>
            </div>
          ) : null}

          <div className="chat-conversations">
            <h3>Conversations</h3>
            {conversationsQuery.isLoading ? <p className="muted">Loading conversations...</p> : null}
            {!conversationsQuery.isLoading && conversations.length === 0 ? (
              <p className="muted">
                No active chats yet. Chats unlock only after payment is completed and close once the service is completed.
              </p>
            ) : null}
            <div className="chat-conversation-list">
              {conversations.map((conversation) => {
                const active = conversation.id === selectedConversationId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`chat-conversation-item ${active ? "chat-conversation-item-active" : ""}`}
                    onClick={() => setSelectedConversationId(conversation.id)}
                  >
                    <span className="chat-conversation-name">{conversationLabel(conversation.id)}</span>
                    <span className="chat-conversation-meta">{conversation.id.slice(0, 8)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="card chat-thread">
          {!selectedConversation ? (
            <p className="muted">Select a conversation to start messaging.</p>
          ) : (
            <>
              <div className="chat-thread-head">
                <h3>{conversationLabel(selectedConversation.id)}</h3>
                <p className="muted">Live thread</p>
              </div>

              {messagesQuery.isError ? <p className="error">{(messagesQuery.error as Error).message}</p> : null}

              <div className="chat-messages">
                {messages.length === 0 ? <p className="muted">No messages yet. Say hello.</p> : null}
                {messages.map((message) => {
                  const mine = message.sender_id === user?.id;
                  return (
                    <div key={message.id} className={`chat-message-row ${mine ? "chat-message-row-mine" : ""}`}>
                      <div className={`chat-bubble ${mine ? "chat-bubble-mine" : ""}`}>
                        <p>{message.message}</p>
                        <span>{new Date(message.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="chat-composer">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message..." />
                <button
                  className="primary-btn"
                  disabled={!draft.trim() || sendMessageMutation.isPending || messagesQuery.isError}
                  onClick={() => sendMessageMutation.mutate()}
                >
                  {sendMessageMutation.isPending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {!realtimeClient ? <p className="muted">Realtime disabled: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p> : null}
    </section>
  );
}
