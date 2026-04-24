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

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  return (
    <section>
      <h2>Messages</h2>

      {user?.role === "client" ? (
        <div className="card">
          <h3>Start conversation</h3>
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

      <div className="card">
        <h3>Conversations</h3>
        <select value={selectedConversationId} onChange={(e) => setSelectedConversationId(e.target.value)}>
          <option value="">Select conversation</option>
          {conversations.map((conversation) => (
            <option key={conversation.id} value={conversation.id}>
              {conversation.id}
            </option>
          ))}
        </select>
      </div>

      {selectedConversation ? (
        <div className="card">
          <h3>Conversation thread</h3>
          <ul className="list">
            {messages.map((message) => (
              <li key={message.id}>
                <span>
                  <b>{message.sender_id === user?.id ? "You" : "Other"}:</b> {message.message}
                </span>
                <span className="muted">{new Date(message.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>

          <label>New message</label>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type message..." />
          <button
            className="primary-btn"
            disabled={!draft.trim() || sendMessageMutation.isPending}
            onClick={() => sendMessageMutation.mutate()}
          >
            {sendMessageMutation.isPending ? "Sending..." : "Send"}
          </button>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {!realtimeClient ? <p className="muted">Realtime disabled: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p> : null}
    </section>
  );
}
