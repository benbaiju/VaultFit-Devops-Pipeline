import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  MoreVertical,
  Paperclip,
  Search,
  Zap,
} from "lucide-react";
import { addTicketComment, getAdminTicketTimeline, getAdminTickets, updateAdminTicket } from "../services/tickets";
import type { Role, SupportTicket, TicketPriority, TicketStatus } from "../types/api";
import { useAuth } from "../state/auth-context";

const STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_user", "resolved", "closed"];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

function formatActorDisplay(actor: { full_name?: string | null; email?: string | null } | null | undefined): string {
  return actor?.full_name?.trim() || actor?.email?.trim() || "User";
}

function formatTicketDisplayId(id: string): string {
  const hex = id.replace(/-/g, "").slice(0, 10);
  const n = Number.parseInt(hex, 16);
  const code = Number.isFinite(n) ? (Math.abs(n) % 9000) + 1000 : 1000;
  return `#VF-${code}`;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function formatRelativeTimeShort(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const min = Math.floor((Date.now() - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function roleSubtitle(role: Role | undefined): string {
  switch (role) {
    case "nutritionist":
      return "Nutritionist";
    case "trainer":
      return "Trainer";
    case "client":
      return "Client";
    case "admin":
      return "Admin";
    default:
      return "User";
  }
}

function userInitials(ticket: SupportTicket): string {
  const name = formatActorDisplay(ticket.created_by);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function isWithinDateRange(createdAt: string, range: "7" | "30" | "all"): boolean {
  if (range === "all") return true;
  const days = range === "7" ? 7 : 30;
  const t = new Date(createdAt).getTime();
  return Date.now() - t <= days * 86400000;
}

type RoleFilter = "any" | Role;

export function AdminSupportPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("any");
  const [dateRange, setDateRange] = useState<"7" | "30" | "all">("7");
  const [search, setSearch] = useState("");
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

  const filteredTickets = useMemo(() => {
    const list = ticketsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((t) => {
      if (!isWithinDateRange(t.created_at, dateRange)) return false;
      if (roleFilter !== "any" && (t.created_by?.role ?? "client") !== roleFilter) return false;
      if (!q) return true;
      const hay = [
        t.subject,
        t.description,
        t.id,
        formatTicketDisplayId(t.id),
        t.created_by?.email,
        t.created_by?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [ticketsQuery.data, search, dateRange, roleFilter]);

  useEffect(() => {
    if (!selectedTicketId) return;
    if (!filteredTickets.some((t) => t.id === selectedTicketId)) {
      setSelectedTicketId("");
    }
  }, [filteredTickets, selectedTicketId]);

  const selectedTicket = useMemo(
    () => filteredTickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [filteredTickets, selectedTicketId],
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

  function resetFilters() {
    setStatusFilter("all");
    setPriorityFilter("all");
    setRoleFilter("any");
    setDateRange("7");
    setSearch("");
  }

  const conversationItems = useMemo(() => {
    if (!selectedTicket) return [];
    type Item = { kind: "msg"; name: string; at: string; body: string };
    const items: Item[] = [];
    items.push({
      kind: "msg",
      name: formatActorDisplay(selectedTicket.created_by),
      at: selectedTicket.created_at,
      body: selectedTicket.description,
    });
    for (const ev of timelineQuery.data ?? []) {
      if (ev.event_type === "comment" && typeof ev.detail?.comment === "string") {
        items.push({
          kind: "msg",
          name: formatActorDisplay(ev.actor),
          at: ev.created_at,
          body: ev.detail.comment,
        });
      }
    }
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return items;
  }, [selectedTicket, timelineQuery.data]);

  if (user?.role !== "admin") {
    return (
      <section className="admin-surface-section support-queue">
        <p className="error">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="admin-surface-section support-queue">
      <div className="support-queue-layout">
        <div className="support-queue-main">
          <header className="support-queue-header">
            <h1 className="support-queue-title">Support Queue</h1>
            <div className="support-queue-search">
              <Search size={16} className="support-queue-search-icon" aria-hidden />
              <input
                type="search"
                className="support-queue-search-input"
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search tickets"
              />
            </div>
          </header>

          <div className="support-queue-filters">
            <div className="support-queue-filter-field">
              <span className="support-queue-filter-label">Status</span>
              <select
                className="support-queue-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")}
              >
                <option value="all">All Statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {labelStatus(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="support-queue-filter-field">
              <span className="support-queue-filter-label">Priority</span>
              <select
                className="support-queue-select"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | "all")}
              >
                <option value="all">All Priorities</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {labelPriority(p)}
                  </option>
                ))}
              </select>
            </div>
            <div className="support-queue-filter-field">
              <span className="support-queue-filter-label">Role</span>
              <select
                className="support-queue-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              >
                <option value="any">Any Role</option>
                <option value="client">Client</option>
                <option value="trainer">Trainer</option>
                <option value="nutritionist">Nutritionist</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="support-queue-filter-field">
              <span className="support-queue-filter-label">Date range</span>
              <div className="support-queue-select-wrap">
                <CalendarDays size={14} className="support-queue-select-icon" aria-hidden />
                <select
                  className="support-queue-select support-queue-select--with-icon"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as "7" | "30" | "all")}
                >
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </div>
            <button type="button" className="support-queue-reset" onClick={resetFilters}>
              Reset Filters
            </button>
          </div>

          {ticketsQuery.isLoading ? <p className="support-queue-loading">Loading tickets…</p> : null}
          {error ? <p className="error support-queue-error">{error}</p> : null}

          <div className="support-queue-table-wrap">
            <table className="support-queue-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="support-queue-th-action" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    selected={ticket.id === selectedTicketId}
                    onSelect={() => setSelectedTicketId(ticket.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {!ticketsQuery.isLoading && filteredTickets.length === 0 ? (
            <p className="support-queue-empty">No tickets match your filters.</p>
          ) : null}
        </div>

        <aside className="support-queue-panel">
          {selectedTicket ? (
            <TicketDetailPanel
              ticket={selectedTicket}
              conversationItems={conversationItems}
              timelineLoading={timelineQuery.isLoading}
              adminReply={adminReply}
              onReplyChange={setAdminReply}
              currentUserId={user.id}
              onAssignMe={() => updateMutation.mutate({ assignedAdminUserId: user.id })}
              onCloseTicket={() => updateMutation.mutate({ status: "closed" })}
              onSendReply={() => {
                if (!adminReply.trim() || commentMutation.isPending) return;
                void commentMutation.mutate();
              }}
              updateBusy={updateMutation.isPending}
              commentBusy={commentMutation.isPending}
            />
          ) : (
            <div className="support-queue-panel-placeholder">
              <p>Select a ticket to view details</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function labelStatus(s: TicketStatus): string {
  const map: Record<TicketStatus, string> = {
    open: "Open",
    in_progress: "In Progress",
    waiting_user: "Waiting User",
    resolved: "Resolved",
    closed: "Closed",
  };
  return map[s];
}

function labelPriority(p: TicketPriority): string {
  const map: Record<TicketPriority, string> = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };
  return map[p];
}

/** Badge text aligned with product mock (normal → MEDIUM). */
function labelPriorityBadge(p: TicketPriority): string {
  const map: Record<TicketPriority, string> = {
    low: "LOW",
    normal: "MEDIUM",
    high: "HIGH",
    urgent: "URGENT",
  };
  return map[p];
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function TicketRow({
  ticket,
  selected,
  onSelect,
}: {
  ticket: SupportTicket;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      className={selected ? "support-queue-tr support-queue-tr--selected" : "support-queue-tr"}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
    >
      <td className="support-queue-td-id">{formatTicketDisplayId(ticket.id)}</td>
      <td>
        <div className="support-queue-user">
          <div className="support-queue-avatar" aria-hidden>
            {userInitials(ticket)}
          </div>
          <div>
            <div className="support-queue-user-name">{formatActorDisplay(ticket.created_by)}</div>
            <div className="support-queue-user-role">{roleSubtitle(ticket.created_by?.role)}</div>
          </div>
        </div>
      </td>
      <td className="support-queue-td-subject">{ticket.subject}</td>
      <td>
        <span className={`support-priority-badge support-priority-badge--${ticket.priority}`}>
          {labelPriorityBadge(ticket.priority)}
        </span>
      </td>
      <td>
        <span className={`support-status-cell support-status-cell--${ticket.status}`}>
          {(ticket.status === "open" || ticket.status === "in_progress") && (
            <span className={`support-status-dot support-status-dot--${ticket.status}`} aria-hidden />
          )}
          {labelStatus(ticket.status)}
        </span>
      </td>
      <td className="support-queue-td-date">{formatRelativeTimeShort(ticket.created_at)}</td>
      <td className="support-queue-td-chevron">
        <ChevronRight size={18} aria-hidden />
      </td>
    </tr>
  );
}

function TicketDetailPanel({
  ticket,
  conversationItems,
  timelineLoading,
  adminReply,
  onReplyChange,
  currentUserId,
  onAssignMe,
  onCloseTicket,
  onSendReply,
  updateBusy,
  commentBusy,
}: {
  ticket: SupportTicket;
  conversationItems: { kind: "msg"; name: string; at: string; body: string }[];
  timelineLoading: boolean;
  adminReply: string;
  onReplyChange: (v: string) => void;
  currentUserId: string;
  onAssignMe: () => void;
  onCloseTicket: () => void;
  onSendReply: () => void;
  updateBusy: boolean;
  commentBusy: boolean;
}) {
  const assigned = ticket.assigned_admin_user_id != null;
  const assignedToMe = ticket.assigned_admin_user_id === currentUserId;

  return (
    <div className="support-panel-inner">
      <header className="support-panel-head">
        <div>
          <div className="support-panel-kicker">Ticket details</div>
          <div className="support-panel-id-row">
            <span className="support-panel-ticket-id">{formatTicketDisplayId(ticket.id)}</span>
            <button type="button" className="support-panel-icon-btn" aria-label="More options">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="support-panel-meta">
        <div className="support-panel-meta-row">
          <span className="support-panel-meta-label">Status</span>
          <span className={`support-meta-badge support-meta-badge--status-${ticket.status}`}>
            {(ticket.status === "open" || ticket.status === "in_progress") && (
              <span className={`support-meta-badge-dot support-meta-badge-dot--${ticket.status}`} aria-hidden />
            )}
            {labelStatus(ticket.status)}
          </span>
        </div>
        <div className="support-panel-meta-row">
          <span className="support-panel-meta-label">Priority</span>
          <span className={`support-priority-badge support-priority-badge--${ticket.priority}`}>
            {labelPriorityBadge(ticket.priority)}
          </span>
        </div>
        <div className="support-panel-meta-row support-panel-meta-row--assign">
          <span className="support-panel-meta-label">Assigned to</span>
          <span className="support-panel-assign">
            {assigned ? formatActorDisplay(ticket.assigned_admin) : "Unassigned"}
            {!assignedToMe && ticket.status !== "closed" ? (
              <button type="button" className="support-panel-link" onClick={onAssignMe} disabled={updateBusy}>
                Assign Me
              </button>
            ) : null}
          </span>
        </div>
      </div>

      <div className="support-panel-thread">
        <h3 className="support-panel-thread-title">Conversation</h3>
        {timelineLoading ? <p className="support-queue-loading">Loading…</p> : null}
        <div className="support-panel-messages">
          {conversationItems.map((msg, idx) => (
            <MessageBlock
              key={`${msg.at}-${idx}`}
              message={msg}
              prevAt={idx > 0 ? conversationItems[idx - 1]!.at : null}
              isFirst={idx === 0}
            />
          ))}
        </div>
      </div>

      <div className="support-panel-compose">
        <textarea
          className="support-panel-textarea"
          rows={3}
          value={adminReply}
          onChange={(e) => onReplyChange(e.target.value)}
          placeholder="Type your response..."
        />
        <div className="support-panel-compose-actions">
          <div className="support-panel-compose-icons">
            <button type="button" className="support-panel-icon-btn" disabled aria-label="Attachments (coming soon)">
              <Paperclip size={18} />
            </button>
            <button type="button" className="support-panel-icon-btn" disabled aria-label="Canned responses (coming soon)">
              <Zap size={18} />
            </button>
          </div>
          <div className="support-panel-compose-buttons">
            <button
              type="button"
              className="support-panel-btn support-panel-btn--ghost"
              disabled={updateBusy || ticket.status === "closed"}
              onClick={onCloseTicket}
            >
              Close Ticket
            </button>
            <button
              type="button"
              className="support-panel-btn support-panel-btn--primary"
              disabled={!adminReply.trim() || commentBusy || ticket.status === "closed"}
              onClick={onSendReply}
            >
              {commentBusy ? "Sending…" : "Send Reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBlock({
  message,
  prevAt,
  isFirst,
}: {
  message: { name: string; at: string; body: string };
  prevAt: string | null;
  isFirst: boolean;
}) {
  const msgDay = new Date(message.at).toDateString();
  const prevDay = prevAt ? new Date(prevAt).toDateString() : null;
  const showDaySep = prevDay != null && msgDay !== prevDay;
  const isToday = msgDay === new Date().toDateString();
  const showTodayLead = isFirst && isToday;

  return (
    <div className="support-msg">
      {showTodayLead ? (
        <div className="support-msg-sep">
          <span>Today</span>
        </div>
      ) : null}
      {showDaySep ? (
        <div className="support-msg-sep">
          <span>
            {isToday ? "Today" : new Date(message.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
      ) : null}
      <div className="support-msg-row">
        <div className="support-msg-avatar" aria-hidden>
          {initialsFromName(message.name)}
        </div>
        <div className="support-msg-main">
          <div className="support-msg-head">
            <span className="support-msg-name">{message.name}</span>
            <span className="support-msg-time">{formatRelativeTime(message.at)}</span>
          </div>
          <p className="support-msg-body">{message.body}</p>
        </div>
      </div>
    </div>
  );
}
