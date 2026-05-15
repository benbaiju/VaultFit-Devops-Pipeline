import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Dumbbell, Ticket, Users } from "lucide-react";
import {
  getAdminStats,
  getAdminTrainers,
  getAdminVerificationRequests,
  getAdminReviewTimeline,
} from "../services/verification";
import { ROUTES } from "../lib/navigation";
import { useAuth } from "../state/auth-context";
import type { AdminTrainer, VerificationRequest } from "../types/api";

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function roleLabelFromTrainer(t: AdminTrainer | undefined): string {
  if (!t) return "Trainer";
  const s = (t.specialty ?? "").toLowerCase();
  if (s.includes("nutri")) return "Nutritionist";
  if (s.includes("yoga")) return "Yoga Instructor";
  return "Personal Trainer";
}

function applicantName(t: AdminTrainer | undefined, fallbackId: string): string {
  return t?.profiles?.full_name?.trim() || t?.profiles?.email || `Trainer ${fallbackId.slice(0, 8)}…`;
}

export function AdminDashboardPage() {
  const { token, user } = useAuth();

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getAdminStats(token),
    enabled: user?.role === "admin",
  });

  const verificationQuery = useQuery({
    queryKey: ["admin-verification-requests"],
    queryFn: () => getAdminVerificationRequests(token),
    enabled: user?.role === "admin",
  });

  const trainersQuery = useQuery({
    queryKey: ["admin-trainers"],
    queryFn: () => getAdminTrainers(token),
    enabled: user?.role === "admin",
  });

  const timelineQuery = useQuery({
    queryKey: ["admin-review-timeline"],
    queryFn: () => getAdminReviewTimeline(token),
    enabled: user?.role === "admin",
  });

  const trainerById = useMemo(() => {
    const m = new Map<string, AdminTrainer>();
    for (const t of trainersQuery.data ?? []) {
      m.set(t.id, t);
    }
    return m;
  }, [trainersQuery.data]);

  const verificationRows = useMemo(() => {
    const list = [...(verificationQuery.data ?? [])];
    list.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    return list.slice(0, 8);
  }, [verificationQuery.data]);

  const statusCounts = useMemo(() => {
    const all = verificationQuery.data ?? [];
    return {
      pending: all.filter((r) => r.status === "pending").length,
      approved: all.filter((r) => r.status === "approved").length,
      rejected: all.filter((r) => r.status === "rejected").length,
    };
  }, [verificationQuery.data]);

  const adminName = user?.full_name?.trim() || user?.email?.split("@")[0] || "Admin";
  const todayLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date());
    } catch {
      return new Date().toDateString();
    }
  }, []);

  if (user?.role !== "admin") {
    return (
      <section className="admin-surface-section">
        <p className="error">Admin access required.</p>
      </section>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard-hero">
        <div>
          <h1 className="admin-dashboard-welcome">Welcome back, {adminName}</h1>
          <p className="admin-dashboard-sub">Here&apos;s what&apos;s happening across VaultFit today.</p>
        </div>
        <button type="button" className="admin-date-pill" disabled aria-label="Selected date">
          <CalendarDays size={16} aria-hidden />
          Today, {todayLabel}
        </button>
      </header>

      <div className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--purple">
            <Users size={20} aria-hidden />
          </div>
          <div className="admin-kpi-meta">Total users</div>
          <div className="admin-kpi-value">{statsQuery.isLoading ? "—" : stats?.total_users ?? 0}</div>
        </article>
        <article className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--green">
            <Dumbbell size={20} aria-hidden />
          </div>
          <div className="admin-kpi-meta">Active trainers / nutritionists</div>
          <div className="admin-kpi-value">{statsQuery.isLoading ? "—" : stats?.active_trainers_nutritionists ?? 0}</div>
        </article>
        <article className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--green">
            <CalendarDays size={20} aria-hidden />
          </div>
          <div className="admin-kpi-meta">Total bookings</div>
          <div className="admin-kpi-value">{statsQuery.isLoading ? "—" : stats?.total_bookings ?? 0}</div>
        </article>
        <article className="admin-kpi-card">
          <div className="admin-kpi-icon admin-kpi-icon--red">
            <Ticket size={20} aria-hidden />
          </div>
          <div className="admin-kpi-meta">Open support tickets</div>
          <div className="admin-kpi-value">{statsQuery.isLoading ? "—" : stats?.open_support_tickets ?? 0}</div>
        </article>
      </div>

      <div className="admin-dashboard-split">
        <section className="admin-card admin-verification-card">
          <div className="admin-card-head">
            <div>
              <h2 className="admin-card-title">Verification status</h2>
              <p className="admin-card-desc">Snapshot of recent trainer applications.</p>
            </div>
            <div className="admin-status-pills">
              <span className="admin-pill admin-pill--pending">Pending: {statusCounts.pending}</span>
              <span className="admin-pill admin-pill--approved">Approved: {statusCounts.approved}</span>
              <span className="admin-pill admin-pill--rejected">Rejected: {statusCounts.rejected}</span>
            </div>
          </div>

          {verificationQuery.isLoading ? <p className="admin-muted-text">Loading…</p> : null}
          {verificationQuery.isError ? (
            <p className="error">{(verificationQuery.error as Error).message}</p>
          ) : null}

          <div className="admin-table-wrap admin-table-wrap--flush">
            <table className="admin-data-table admin-data-table--compact">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Role</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {verificationRows.map((row) => (
                  <VerificationDashboardRow key={row.id} request={row} trainer={trainerById.get(row.trainer_id)} />
                ))}
              </tbody>
            </table>
          </div>
          {!verificationQuery.isLoading && verificationRows.length === 0 ? (
            <p className="admin-muted-text">No verification requests yet.</p>
          ) : null}
        </section>

        <aside className="admin-card admin-activity-card">
          <h2 className="admin-card-title">System activity</h2>
          <p className="admin-card-desc">Latest admin and verification events.</p>
          {timelineQuery.isLoading ? <p className="admin-muted-text">Loading…</p> : null}
          <ul className="admin-activity-list">
            {(timelineQuery.data?.items ?? []).slice(0, 6).map((item) => (
              <li key={item.id} className="admin-activity-item">
                <span className="admin-activity-dot" aria-hidden />
                <div>
                  <div className="admin-activity-action">{formatTimelineAction(item.action)}</div>
                  <div className="admin-activity-time">{formatRelativeTime(item.at)}</div>
                </div>
              </li>
            ))}
          </ul>
          {!timelineQuery.isLoading && (timelineQuery.data?.items ?? []).length === 0 ? (
            <p className="admin-muted-text">No activity logged yet.</p>
          ) : null}
          {timelineQuery.data?.warning ? <p className="error text-sm">{timelineQuery.data.warning}</p> : null}
        </aside>
      </div>
    </div>
  );
}

function formatTimelineAction(action: string): string {
  const map: Record<string, string> = {
    verification_approved: "Verification approved",
    verification_rejected: "Verification rejected",
    user_access_blocked: "User access blocked",
    user_access_restored: "User access restored",
    trainer_verified_granted: "Verified badge granted",
    trainer_verified_revoked: "Verified badge revoked",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

function VerificationDashboardRow({
  request,
  trainer,
}: {
  request: VerificationRequest;
  trainer: AdminTrainer | undefined;
}) {
  const role = roleLabelFromTrainer(trainer);
  const name = applicantName(trainer, request.trainer_id);
  const rel = formatRelativeTime(request.submitted_at);

  return (
    <tr>
      <td>
        <div className="admin-cell-strong">{name}</div>
      </td>
      <td>
        <span className="admin-role-tag">{role}</span>
      </td>
      <td className="admin-muted-text">{rel}</td>
      <td>
        <span className={`admin-status-cell admin-status-cell--${request.status}`}>
          <span className="admin-status-dot" aria-hidden />
          {request.status === "pending" ? "Pending" : request.status === "approved" ? "Approved" : "Rejected"}
        </span>
      </td>
      <td>
        {request.status === "pending" ? (
          <Link className="admin-link-action" to={ROUTES.admin.verifications}>
            Review
          </Link>
        ) : (
          <Link className="admin-link-muted" to={ROUTES.admin.verifications}>
            View
          </Link>
        )}
      </td>
    </tr>
  );
}
