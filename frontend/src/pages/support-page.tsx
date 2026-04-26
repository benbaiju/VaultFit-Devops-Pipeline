import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addTicketComment, createTicket, getMyTickets, getTicketTimeline } from "../services/tickets";
import type { TicketCategory, TicketPriority } from "../types/api";
import { useAuth } from "../state/auth-context";

const CATEGORIES: TicketCategory[] = ["booking", "payment", "verification", "account", "technical", "other"];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

function extractEventMessage(detail: Record<string, unknown> | undefined): string {
  if (!detail) return "";
  const isUuidLike = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const clean = (value: unknown): string => {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed || isUuidLike(trimmed)) return "";
    return trimmed;
  };
  const comment = detail.comment;
  const safeComment = clean(comment);
  if (safeComment) return safeComment;
  const note = detail.resolution_note;
  const safeNote = clean(note);
  if (safeNote) return safeNote;
  const to = detail.to;
  const safeTo = clean(to);
  if (safeTo) return safeTo;
  return "";
}

function formatEventLabel(eventType: string): string {
  if (eventType === "created") return "Ticket created";
  if (eventType === "assigned") return "Assigned";
  if (eventType === "priority_changed") return "Priority changed";
  if (eventType === "status_changed") return "Status changed";
  if (eventType === "comment") return "Reply";
  if (eventType === "closed") return "Closed";
  if (eventType === "reopened") return "Reopened";
  return eventType;
}

function formatActorDisplay(actor: { full_name?: string | null; email?: string | null } | null | undefined): string {
  return actor?.full_name?.trim() || actor?.email?.trim() || "Support team";
}

export function SupportPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("other");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState("");
  const trimmedSubject = subject.trim();
  const trimmedDescription = description.trim();
  const canSubmit = trimmedSubject.length >= 3 && trimmedDescription.length >= 5;

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: () => getMyTickets(token),
  });
  const timelineQuery = useQuery({
    queryKey: ["ticket-timeline", selectedTicketId],
    queryFn: () => getTicketTimeline(token, selectedTicketId),
    enabled: Boolean(selectedTicketId),
    refetchInterval: selectedTicketId ? 5000 : false,
  });

  const createMutation = useMutation({
    mutationFn: () => createTicket(token, { subject: trimmedSubject, description: trimmedDescription, category, priority }),
    onSuccess: (ticket) => {
      setSubject("");
      setDescription("");
      setCategory("other");
      setPriority("normal");
      setError("");
      setSelectedTicketId(ticket.id);
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const commentMutation = useMutation({
    mutationFn: () => addTicketComment(token, selectedTicketId, commentDraft.trim()),
    onSuccess: () => {
      setCommentDraft("");
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["ticket-timeline", selectedTicketId] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const tickets = ticketsQuery.data ?? [];
  const selectedTicket = useMemo(() => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null, [selectedTicketId, tickets]);

  return (
    <section>
      <h2>Support</h2>
      <p className="muted">
        Open a support ticket for issues related to your account, bookings, payments, or technical problems.
      </p>

      <div className="card">
        <h3>Create ticket</h3>
        <label>Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Briefly describe your issue" />
        {trimmedSubject.length > 0 && trimmedSubject.length < 3 ? (
          <p className="muted">Subject must be at least 3 characters.</p>
        ) : null}
        <label>Description</label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details so support can help faster..."
        />
        {trimmedDescription.length > 0 && trimmedDescription.length < 5 ? (
          <p className="muted">Description must be at least 5 characters.</p>
        ) : null}
        <div className="inline-actions">
          <div>
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="primary-btn" disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? "Submitting..." : "Submit ticket"}
        </button>
      </div>

      <div className="card">
        <h3>My tickets</h3>
        {ticketsQuery.isLoading ? <p>Loading tickets...</p> : null}
        {!ticketsQuery.isLoading && tickets.length === 0 ? <p className="muted">No tickets yet.</p> : null}
        <ul className="list">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button type="button" className="support-ticket-item" onClick={() => setSelectedTicketId(ticket.id)}>
                <span>
                  <b>{ticket.subject}</b> · {ticket.category}
                </span>
                <span className={`badge support-status support-status-${ticket.status}`}>{ticket.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selectedTicket ? (
        <div className="card">
          <h3>Ticket details</h3>
          <p>
            <b>{selectedTicket.subject}</b>
          </p>
          <p className="muted">{selectedTicket.description}</p>
          <p className="muted">
            Status: <b>{selectedTicket.status}</b> · Priority: <b>{selectedTicket.priority}</b> · Created:{" "}
            {new Date(selectedTicket.created_at).toLocaleString()}
          </p>
          {selectedTicket.resolution_note ? (
            <p className="muted">
              Resolution: <b>{selectedTicket.resolution_note}</b>
            </p>
          ) : null}
          <h4>Conversation</h4>
          {timelineQuery.isLoading ? <p>Loading conversation...</p> : null}
          {!timelineQuery.isLoading && (timelineQuery.data ?? []).length === 0 ? <p className="muted">No updates yet.</p> : null}
          <ul className="list support-conversation-list">
            {(timelineQuery.data ?? []).map((event) => (
              <li key={event.id} className="support-conversation-item">
                <p className="support-conversation-meta">
                  <b>{formatEventLabel(event.event_type)}</b> · {new Date(event.created_at).toLocaleString()} ·{" "}
                  {formatActorDisplay(event.actor)}
                </p>
                {extractEventMessage(event.detail) ? <p className="support-conversation-message">{extractEventMessage(event.detail)}</p> : null}
              </li>
            ))}
          </ul>
          <label>Add comment</label>
          <textarea
            rows={3}
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="Reply to support..."
          />
          <button
            className="secondary-btn"
            disabled={!commentDraft.trim() || commentMutation.isPending}
            onClick={() => commentMutation.mutate()}
          >
            {commentMutation.isPending ? "Sending..." : "Post comment"}
          </button>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <style>{`
        .support-ticket-item {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-primary);
          padding: 0.75rem 0.8rem;
          text-align: left;
        }
        .support-status {
          text-transform: uppercase;
          font-size: 0.72rem;
        }
        .support-conversation-list {
          display: grid;
          gap: 0.5rem;
          padding: 0;
          margin: 0.35rem 0 0.75rem;
          list-style: none;
        }
        .support-conversation-item {
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 0.65rem 0.75rem;
          background: rgba(255, 255, 255, 0.02);
        }
        .support-conversation-meta {
          margin: 0;
        }
        .support-conversation-message {
          margin: 0.35rem 0 0;
          color: var(--text-muted);
          white-space: pre-wrap;
          word-break: break-word;
        }
      `}</style>
      {user?.role === "admin" ? <p className="muted">Admin users should use the Admin Support console.</p> : null}
    </section>
  );
}
