import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addDays,
  format,
  formatDistanceToNow,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import { ROUTES } from "../lib/navigation";
import { getMyTrainerProfile } from "../services/trainers";
import { getBookings } from "../services/bookings";
import { getPlans } from "../services/plans";
import { getNotifications } from "../services/messaging";
import { useAuth } from "../state/auth-context";
import {
  Calendar,
  Users,
  MessageSquare,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  CheckCircle,
  Clock,
} from "lucide-react";
import type { Booking, Notification } from "../types/api";

function sortBookingsByTime(a: Booking, b: Booking): number {
  return a.start_time.localeCompare(b.start_time);
}

export function TrainerDashboardPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [scheduleDay, setScheduleDay] = useState(() => new Date());

  const meQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const isVerified = meQuery.data?.verified === true;

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => getPlans(token),
    enabled: Boolean(token) && isVerified,
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(token),
    enabled: Boolean(token) && isVerified,
  });

  const bookings = bookingsQuery.data ?? [];
  const isNutritionist = user?.role === "nutritionist";
  const dashboardTitle = isNutritionist ? "Nutritionist Dashboard" : "Trainer Dashboard";

  const upcomingBookingsCount = useMemo(() => {
    const today = startOfDay(new Date());
    return bookings.filter((b) => {
      const d = parseISO(b.booking_date);
      if (Number.isNaN(d.getTime())) return false;
      const day = startOfDay(d);
      if (day < today) return false;
      return b.status === "pending" || b.status === "confirmed";
    }).length;
  }, [bookings]);

  const activeClientsCount = useMemo(() => new Set(bookings.map((b) => b.client_id).filter(Boolean)).size, [bookings]);

  const pendingMessagesCount = useMemo(() => {
    const list = notificationsQuery.data ?? [];
    return list.filter((n) => !n.is_read).length;
  }, [notificationsQuery.data]);

  const planUpdatesCount = plansQuery.data?.length ?? 0;

  const dayBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        try {
          return isSameDay(parseISO(b.booking_date), scheduleDay);
        } catch {
          return false;
        }
      })
      .filter((b) => b.status === "pending" || b.status === "confirmed")
      .sort(sortBookingsByTime);
  }, [bookings, scheduleDay]);

  const activityItems = useMemo(() => {
    const list = (notificationsQuery.data ?? []).slice();
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list.slice(0, 5);
  }, [notificationsQuery.data]);

  const displayName =
    meQuery.data?.profiles?.full_name?.trim() || user?.full_name?.trim() || user?.email?.split("@")[0] || "Trainer";

  return (
    <section className="trainer-dash">
      <div className="trainer-dash-top">
        <div>
          <h1 className="trainer-dash-title">{dashboardTitle}</h1>
          <p className="trainer-dash-lead muted">
            {isVerified
              ? "Here is a snapshot of your schedule, clients, and activity."
              : "Complete verification to unlock bookings, plans, and client tools."}
          </p>
        </div>
        <div className="trainer-dash-actions">
          <button
            type="button"
            className="trainer-dash-icon-btn"
            aria-label="Search"
            onClick={() => navigate(isVerified ? ROUTES.trainer.messages : ROUTES.trainer.verification)}
          >
            <Search size={18} />
          </button>
          <Link
            to={isVerified ? ROUTES.trainer.plans : ROUTES.trainer.verification}
            className="trainer-dash-new-plan"
          >
            <Plus size={18} aria-hidden />
            New plan
          </Link>
        </div>
      </div>

      <div className={`trainer-dash-status ${isVerified ? "trainer-dash-status--ok" : "trainer-dash-status--wait"}`}>
        {isVerified ? <CheckCircle size={16} /> : <Clock size={16} />}
        <span>{isVerified ? "Profile verified" : "Pending verification"}</span>
      </div>

      <div className="trainer-dash-stats">
        <article className="trainer-dash-stat">
          <div className="trainer-dash-stat-icon" aria-hidden>
            <Calendar size={20} />
          </div>
          <p className="trainer-dash-stat-value">{upcomingBookingsCount}</p>
          <p className="trainer-dash-stat-label">Upcoming bookings</p>
        </article>
        <article className="trainer-dash-stat">
          <div className="trainer-dash-stat-icon trainer-dash-stat-icon--green" aria-hidden>
            <Users size={20} />
          </div>
          <p className="trainer-dash-stat-value">{activeClientsCount}</p>
          <p className="trainer-dash-stat-label">Active clients</p>
        </article>
        <article className="trainer-dash-stat">
          <div className="trainer-dash-stat-icon trainer-dash-stat-icon--cyan" aria-hidden>
            <MessageSquare size={20} />
          </div>
          <p className="trainer-dash-stat-value">{isVerified ? pendingMessagesCount : "—"}</p>
          <p className="trainer-dash-stat-label">Pending messages</p>
        </article>
        <article className="trainer-dash-stat">
          <div className="trainer-dash-stat-icon trainer-dash-stat-icon--violet" aria-hidden>
            <BarChart3 size={20} />
          </div>
          <p className="trainer-dash-stat-value">{isVerified ? planUpdatesCount : "—"}</p>
          <p className="trainer-dash-stat-label">Plan updates</p>
        </article>
      </div>

      <div className="trainer-dash-split">
        <section className="trainer-dash-panel">
          <div className="trainer-dash-panel-head">
            <h2 className="trainer-dash-panel-title">Today&apos;s schedule</h2>
            <div className="trainer-dash-date-nav">
              <button
                type="button"
                className="trainer-dash-round-btn"
                aria-label="Previous day"
                onClick={() => setScheduleDay((d) => addDays(d, -1))}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="trainer-dash-date-label">{format(scheduleDay, "MMMM d, yyyy")}</span>
              <button
                type="button"
                className="trainer-dash-round-btn"
                aria-label="Next day"
                onClick={() => setScheduleDay((d) => addDays(d, 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="trainer-dash-panel-body">
            {bookingsQuery.isLoading ? <p className="muted">Loading schedule…</p> : null}
            {!bookingsQuery.isLoading && dayBookings.length === 0 ? (
              <div className="trainer-dash-empty">
                <Calendar size={28} className="muted" />
                <p className="trainer-dash-empty-title">No sessions this day</p>
                <p className="muted trainer-dash-empty-text">Bookings you confirm for this date will show here.</p>
              </div>
            ) : (
              <ul className="trainer-dash-schedule">
                {dayBookings.map((b, idx) => (
                  <li
                    key={b.id}
                    className={`trainer-dash-slot ${idx % 2 === 0 ? "trainer-dash-slot--a" : "trainer-dash-slot--b"}`}
                  >
                    <div className="trainer-dash-slot-time">
                      <span>{b.start_time.slice(0, 5)}</span>
                      <span className="muted trainer-dash-slot-end">{b.end_time.slice(0, 5)}</span>
                    </div>
                    <div className="trainer-dash-slot-main">
                      <p className="trainer-dash-slot-title">Session</p>
                      <p className="trainer-dash-slot-meta muted">
                        Client booking · <span className={`trainer-dash-pill trainer-dash-pill--${b.status}`}>{b.status}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Link
              to={isVerified ? ROUTES.trainer.bookings : ROUTES.trainer.verification}
              className="trainer-dash-add-slot"
            >
              <Plus size={18} />
              Add session
            </Link>
          </div>

          <Link
            to={isVerified ? ROUTES.trainer.bookings : ROUTES.trainer.verification}
            className="trainer-dash-foot-btn"
          >
            View full calendar
          </Link>
        </section>

        <section className="trainer-dash-panel">
          <div className="trainer-dash-panel-head">
            <h2 className="trainer-dash-panel-title">Recent activity</h2>
          </div>
          <div className="trainer-dash-panel-body trainer-dash-activity-body">
            {!isVerified ? (
              <p className="muted">
                Welcome, {displayName}. Finish verification to see live notifications and client activity here.
              </p>
            ) : notificationsQuery.isLoading ? (
              <p className="muted">Loading activity…</p>
            ) : activityItems.length === 0 ? (
              <PlaceholderActivity />
            ) : (
              <ul className="trainer-dash-activity">
                {activityItems.map((n) => (
                  <ActivityRow key={n.id} notification={n} />
                ))}
              </ul>
            )}
          </div>
          <Link to={ROUTES.trainer.notifications} className="trainer-dash-foot-btn">
            Show all activity
          </Link>
        </section>
      </div>

      {!isVerified ? (
        <div className="trainer-dash-onboard">
          <strong>Next step</strong>
          <p>
            Open <Link to={ROUTES.trainer.profile}>Profile</Link> and{" "}
            <Link to={ROUTES.trainer.verification}>Verification</Link> so admins can approve your account.
          </p>
        </div>
      ) : null}

      <style>{`
        .trainer-dash {
          max-width: 1180px;
          margin: 0 auto;
        }
        .trainer-dash-top {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .trainer-dash-title {
          margin: 0 0 0.35rem;
          font-size: 1.65rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text-primary);
        }
        .trainer-dash-lead {
          margin: 0;
          max-width: 36rem;
          font-size: 0.95rem;
        }
        .trainer-dash-actions {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .trainer-dash-icon-btn {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .trainer-dash-icon-btn:hover {
          color: #fff;
          border-color: rgba(56, 189, 248, 0.45);
          background: rgba(56, 189, 248, 0.1);
        }
        .trainer-dash-new-plan {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.55rem 1.15rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          text-decoration: none;
          color: #0b1020;
          background: linear-gradient(135deg, #7dd3fc, #38bdf8);
          border: 1px solid rgba(125, 211, 252, 0.5);
          box-shadow: 0 8px 24px rgba(56, 189, 248, 0.25);
        }
        .trainer-dash-new-plan:hover {
          filter: brightness(1.06);
        }
        .trainer-dash-status {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.4rem 0.85rem;
          border-radius: 999px;
          font-size: 0.82rem;
          font-weight: 600;
          margin-bottom: 1.35rem;
        }
        .trainer-dash-status--ok {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }
        .trainer-dash-status--wait {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }
        .trainer-dash-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.75rem;
        }
        .trainer-dash-stat {
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: 14px;
          padding: 1.1rem 1.15rem;
          position: relative;
          overflow: hidden;
        }
        .trainer-dash-stat::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, #38bdf8, #6366f1);
          opacity: 0.9;
        }
        .trainer-dash-stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(56, 189, 248, 0.12);
          color: #38bdf8;
          margin-bottom: 0.65rem;
        }
        .trainer-dash-stat-icon--green {
          background: rgba(52, 211, 153, 0.12);
          color: #34d399;
        }
        .trainer-dash-stat-icon--cyan {
          background: rgba(34, 211, 238, 0.12);
          color: #22d3ee;
        }
        .trainer-dash-stat-icon--violet {
          background: rgba(167, 139, 250, 0.12);
          color: #a78bfa;
        }
        .trainer-dash-stat-value {
          margin: 0;
          font-size: 1.85rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .trainer-dash-stat-label {
          margin: 0.15rem 0 0;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          font-weight: 600;
        }
        .trainer-dash-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
          align-items: stretch;
        }
        @media (max-width: 920px) {
          .trainer-dash-split {
            grid-template-columns: 1fr;
          }
        }
        .trainer-dash-panel {
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          min-height: 380px;
          overflow: hidden;
        }
        .trainer-dash-panel-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 1rem 1.15rem;
          border-bottom: 1px solid var(--border-light);
        }
        .trainer-dash-panel-title {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
        }
        .trainer-dash-date-nav {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .trainer-dash-date-label {
          font-size: 0.88rem;
          color: var(--text-secondary);
          font-weight: 600;
          min-width: 9.5rem;
          text-align: center;
        }
        .trainer-dash-round-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .trainer-dash-round-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.06);
        }
        .trainer-dash-panel-body {
          flex: 1;
          padding: 1rem 1.15rem 0.75rem;
        }
        .trainer-dash-activity-body {
          min-height: 200px;
        }
        .trainer-dash-empty {
          text-align: center;
          padding: 2rem 1rem;
          border: 1px dashed var(--border-light);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.12);
        }
        .trainer-dash-empty-title {
          margin: 0.5rem 0 0.25rem;
          font-weight: 700;
        }
        .trainer-dash-empty-text {
          margin: 0;
          font-size: 0.88rem;
        }
        .trainer-dash-schedule {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        .trainer-dash-slot {
          display: flex;
          gap: 0.85rem;
          padding: 0.85rem 1rem;
          border-radius: 12px;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.02);
        }
        .trainer-dash-slot--a {
          border-left: 3px solid #38bdf8;
        }
        .trainer-dash-slot--b {
          border-left: 3px solid #34d399;
        }
        .trainer-dash-slot-time {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 52px;
          font-weight: 700;
          font-size: 0.95rem;
        }
        .trainer-dash-slot-end {
          font-size: 0.72rem;
          font-weight: 500;
        }
        .trainer-dash-slot-main {
          flex: 1;
          min-width: 0;
        }
        .trainer-dash-slot-title {
          margin: 0 0 0.2rem;
          font-weight: 700;
          font-size: 0.95rem;
        }
        .trainer-dash-slot-meta {
          margin: 0;
          font-size: 0.82rem;
        }
        .trainer-dash-pill {
          display: inline-block;
          padding: 0.1rem 0.45rem;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .trainer-dash-pill--confirmed {
          background: rgba(52, 211, 153, 0.15);
          color: #34d399;
        }
        .trainer-dash-pill--pending {
          background: rgba(251, 191, 36, 0.15);
          color: #fbbf24;
        }
        .trainer-dash-add-slot {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          margin-top: 0.85rem;
          padding: 0.65rem;
          border-radius: 12px;
          border: 1px dashed rgba(129, 140, 248, 0.45);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.88rem;
          text-decoration: none;
        }
        .trainer-dash-add-slot:hover {
          color: #a5b4fc;
          border-color: rgba(165, 180, 252, 0.7);
          background: rgba(99, 102, 241, 0.06);
        }
        .trainer-dash-foot-btn {
          display: block;
          text-align: center;
          padding: 0.85rem 1rem;
          font-weight: 700;
          font-size: 0.88rem;
          text-decoration: none;
          color: var(--text-primary);
          border-top: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.02);
        }
        .trainer-dash-foot-btn:hover {
          background: rgba(99, 102, 241, 0.1);
          color: #c7d2fe;
        }
        .trainer-dash-activity {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .trainer-dash-act-row {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border-light);
        }
        .trainer-dash-act-row:last-child {
          border-bottom: none;
        }
        .trainer-dash-act-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(145deg, #6366f1, #38bdf8);
          color: #fff;
          font-weight: 800;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .trainer-dash-act-body {
          flex: 1;
          min-width: 0;
        }
        .trainer-dash-act-text {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.4;
        }
        .trainer-dash-act-text strong {
          color: var(--text-primary);
          font-weight: 700;
        }
        .trainer-dash-act-time {
          margin: 0.2rem 0 0;
          font-size: 0.78rem;
        }
        .trainer-dash-onboard {
          margin-top: 1.5rem;
          padding: 1rem 1.15rem;
          border-radius: 12px;
          border: 1px dashed rgba(251, 191, 36, 0.45);
          background: rgba(245, 158, 11, 0.08);
        }
        .trainer-dash-onboard strong {
          color: #fbbf24;
          display: block;
          margin-bottom: 0.35rem;
        }
        .trainer-dash-onboard p {
          margin: 0;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        .trainer-dash-onboard a {
          color: #7dd3fc;
          font-weight: 600;
        }
      `}</style>
    </section>
  );
}

function ActivityRow({ notification }: { notification: Notification }) {
  const initial = notification.title?.charAt(0)?.toUpperCase() || "•";
  const rel = formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true });
  return (
    <li className="trainer-dash-act-row">
      <div className="trainer-dash-act-avatar" aria-hidden>
        {initial}
      </div>
      <div className="trainer-dash-act-body">
        <p className="trainer-dash-act-text">
          <strong>{notification.title}</strong> — {notification.body}
        </p>
        <p className="trainer-dash-act-time muted">{rel}</p>
      </div>
    </li>
  );
}

function PlaceholderActivity() {
  const rows = [
    { who: "VaultFit", what: "New booking requests will appear here.", when: "Soon" },
    { who: "Tips", what: "Assign plans from the Plans tab after you verify.", when: "—" },
  ];
  return (
    <ul className="trainer-dash-activity">
      {rows.map((r, i) => (
        <li key={i} className="trainer-dash-act-row">
          <div className="trainer-dash-act-avatar" aria-hidden>
            {r.who.charAt(0)}
          </div>
          <div className="trainer-dash-act-body">
            <p className="trainer-dash-act-text">
              <strong>{r.who}</strong> — {r.what}
            </p>
            <p className="trainer-dash-act-time muted">{r.when}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
