import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addTicketComment, createTicket, getMyTickets } from "../services/tickets";
import type { TicketCategory, TicketPriority } from "../types/api";
import { useAuth } from "../state/auth-context";

const CATEGORIES: TicketCategory[] = ["booking", "payment", "verification", "account", "technical", "other"];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

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
      `}</style>
      {user?.role === "admin" ? <p className="muted">Admin users should use the Admin Support console.</p> : null}
    </section>
  );
}
