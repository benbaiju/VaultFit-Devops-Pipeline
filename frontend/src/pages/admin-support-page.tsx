import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addTicketComment, getAdminTicketTimeline, getAdminTickets, updateAdminTicket } from "../services/tickets";
import type { TicketPriority, TicketStatus } from "../types/api";
import { useAuth } from "../state/auth-context";

const STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_user", "resolved", "closed"];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

function formatActorDisplay(actor: { full_name?: string | null; email?: string | null } | null | undefined): string {
  return actor?.full_name?.trim() || actor?.email?.trim() || "User";
}

export function AdminSupportPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [adminReply, setAdminReply] = useState("");
  const [error, setError] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["admin-tickets", statusFilter, priorityFilter],
    queryFn: () =>
      getAdminTickets(token, {
        status: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
      }),
  });
  const timelineQuery = useQuery({
    queryKey: ["admin-ticket-timeline", selectedTicketId],
    queryFn: () => getAdminTicketTimeline(token, selectedTicketId),
    enabled: Boolean(selectedTicketId),
  });

  const selectedTicket = useMemo(
    () => (ticketsQuery.data ?? []).find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, ticketsQuery.data],
  );

  const updateMutation = useMutation({
    mutationFn: (input: { status?: TicketStatus; priority?: TicketPriority; assignedAdminUserId?: string | null }) =>
      updateAdminTicket(token, selectedTicketId, input),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-ticket-timeline", selectedTicketId] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const commentMutation = useMutation({
    mutationFn: () => addTicketComment(token, selectedTicketId, adminReply.trim()),
    onSuccess: () => {
      setError("");
      setAdminReply("");
      void queryClient.invalidateQueries({ queryKey: ["admin-ticket-timeline", selectedTicketId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <section>
      <h2>Admin Support</h2>
      <p className="muted">Triage and resolve customer support tickets.</p>
      <div className="card">
        <h3>Filters</h3>
        <div className="inline-actions">
          <div>
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")}>
              <option value="all">all</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Priority</label>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | "all")}>
              <option value="all">all</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Tickets</h3>
        {ticketsQuery.isLoading ? <p>Loading tickets...</p> : null}
        {!ticketsQuery.isLoading && (ticketsQuery.data ?? []).length === 0 ? <p className="muted">No tickets found.</p> : null}
        <ul className="list">
          {(ticketsQuery.data ?? []).map((ticket) => (
            <li key={ticket.id}>
              <button type="button" className="support-ticket-item" onClick={() => setSelectedTicketId(ticket.id)}>
                <span>
                  <b>{ticket.subject}</b> · {ticket.created_by?.full_name ?? ticket.created_by?.email ?? ticket.created_by_user_id}
                </span>
                <span className={`badge support-status support-status-${ticket.status}`}>
                  {ticket.status} · {ticket.priority}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selectedTicket ? (
        <div className="card">
          <h3>Ticket Actions</h3>
          <p>
            <b>{selectedTicket.subject}</b>
          </p>
          <p className="muted">{selectedTicket.description}</p>
          <div className="inline-actions">
            <button
              className="secondary-btn"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ assignedAdminUserId: user?.id ?? null })}
            >
              Assign to me
            </button>
            <select
              value={selectedTicket.status}
              onChange={(e) => updateMutation.mutate({ status: e.target.value as TicketStatus })}
              disabled={updateMutation.isPending}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={selectedTicket.priority}
              onChange={(e) => updateMutation.mutate({ priority: e.target.value as TicketPriority })}
              disabled={updateMutation.isPending}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <h4>Timeline</h4>
          {timelineQuery.isLoading ? <p>Loading timeline...</p> : null}
          {!timelineQuery.isLoading && (timelineQuery.data ?? []).length === 0 ? <p className="muted">No timeline events yet.</p> : null}
          <ul className="list">
            {(timelineQuery.data ?? []).map((event) => (
              <li key={event.id}>
                <span>
                  <b>{event.event_type}</b> · {new Date(event.created_at).toLocaleString()} ·{" "}
                  {formatActorDisplay(event.actor)}
                </span>
                {event.event_type === "comment" && typeof event.detail?.comment === "string" ? (
                  <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                    {event.detail.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <label>Admin reply</label>
          <textarea
            rows={3}
            value={adminReply}
            onChange={(e) => setAdminReply(e.target.value)}
            placeholder="Reply to user and update the ticket thread..."
          />
          <button
            className="secondary-btn"
            disabled={!adminReply.trim() || commentMutation.isPending}
            onClick={() => commentMutation.mutate()}
          >
            {commentMutation.isPending ? "Posting..." : "Post admin reply"}
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
    </section>
  );
}
