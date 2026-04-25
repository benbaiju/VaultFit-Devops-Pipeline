import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  getAdminReviewTimeline,
  getAdminTrainers,
  getAdminUsers,
  getAdminVerificationRequests,
  reviewVerificationRequest,
  setTrainerVerifiedState,
  setUserAccess,
} from "../services/verification";
import { useAuth } from "../state/auth-context";
import type { AdminReviewTimelineItem, AdminTrainer, VerificationRequest } from "../types/api";

type AdminTab = "pending" | "history" | "trainers" | "users";
type TrainerView = "all" | "nutritionists" | "other";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function isNutritionistBySpecialty(specialty: string | null | undefined) {
  return (specialty ?? "").toLowerCase().includes("nutri");
}

function timelineActionLabel(action: string): string {
  const map: Record<string, string> = {
    verification_approved: "Verification approved",
    verification_rejected: "Verification rejected",
    user_access_blocked: "Access blocked",
    user_access_restored: "Access restored",
    trainer_verified_granted: "Verified badge granted",
    trainer_verified_revoked: "Verified badge revoked",
  };
  return map[action] ?? action;
}

export function AdminPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>("pending");
  /** Notes are keyed per request id so each row has its own text before Approve / Reject. */
  const [notesByRequestId, setNotesByRequestId] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [trainerView, setTrainerView] = useState<TrainerView>("all");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getAdminUsers(token),
    enabled: user?.role === "admin",
  });

  const trainersQuery = useQuery({
    queryKey: ["admin-trainers"],
    queryFn: () => getAdminTrainers(token),
    enabled: user?.role === "admin",
  });

  const verificationQuery = useQuery({
    queryKey: ["admin-verification-requests"],
    queryFn: () => getAdminVerificationRequests(token),
    enabled: user?.role === "admin",
  });

  const reviewTimelineQuery = useQuery({
    queryKey: ["admin-review-timeline"],
    queryFn: () => getAdminReviewTimeline(token),
    enabled: user?.role === "admin",
  });

  const allRequests = verificationQuery.data ?? [];
  const allTrainers = trainersQuery.data ?? [];
  const pending = useMemo(() => allRequests.filter((r) => r.status === "pending"), [allRequests]);
  const nutritionists = useMemo(
    () => allTrainers.filter((t) => isNutritionistBySpecialty(t.specialty)),
    [allTrainers],
  );
  const fitnessTrainers = useMemo(
    () => allTrainers.filter((t) => !isNutritionistBySpecialty(t.specialty)),
    [allTrainers],
  );
  const visibleTrainers =
    trainerView === "nutritionists" ? nutritionists : trainerView === "other" ? fitnessTrainers : allTrainers;

  // Seed notes for pending cards from any previously saved admin_notes on requests
  useEffect(() => {
    if (!allRequests.length) return;
    setNotesByRequestId((prev) => {
      const next = { ...prev };
      for (const r of allRequests) {
        if (r.admin_notes != null && r.admin_notes !== "" && next[r.id] === undefined) {
          next[r.id] = r.admin_notes;
        }
      }
      return next;
    });
  }, [allRequests]);

  const accessMutation = useMutation({
    mutationFn: (params: { userId: string; suspended: boolean }) => setUserAccess(token, params.userId, params.suspended),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-review-timeline"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const trainerVerifiedMutation = useMutation({
    mutationFn: (params: { trainerId: string; verified: boolean }) =>
      setTrainerVerifiedState(token, params.trainerId, params.verified),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["admin-trainers"] });
      void queryClient.invalidateQueries({ queryKey: ["trainers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-review-timeline"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const reviewMutation = useMutation({
    mutationFn: (params: { requestId: string; status: "approved" | "rejected" }) =>
      reviewVerificationRequest(token, params.requestId, {
        status: params.status,
        adminNotes: notesByRequestId[params.requestId]?.trim() || undefined,
      }),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["admin-verification-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["trainers"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-review-timeline"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  function setNoteFor(id: string, value: string) {
    setNotesByRequestId((prev) => ({ ...prev, [id]: value }));
  }

  if (user?.role !== "admin") {
    return (
      <section>
        <h2>Admin</h2>
        <p className="error">Admin access required.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Admin console</h2>
      <p className="muted">
        Review verification requests, set verified for trainers and nutritionists, and suspend user access when needed.
      </p>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          className={tab === "pending" ? "admin-tab active" : "admin-tab"}
          onClick={() => setTab("pending")}
          role="tab"
          aria-selected={tab === "pending"}
        >
          Pending requests
          {pending.length > 0 ? <span className="admin-tab-count">{pending.length}</span> : null}
        </button>
        <button
          type="button"
          className={tab === "history" ? "admin-tab active" : "admin-tab"}
          onClick={() => setTab("history")}
          role="tab"
          aria-selected={tab === "history"}
        >
          Review history
        </button>
        <button
          type="button"
          className={tab === "trainers" ? "admin-tab active" : "admin-tab"}
          onClick={() => setTab("trainers")}
          role="tab"
          aria-selected={tab === "trainers"}
        >
          Trainers <span className="admin-tab-amp">&amp;</span> nutritionists
        </button>
        <button
          type="button"
          className={tab === "users" ? "admin-tab active" : "admin-tab"}
          onClick={() => setTab("users")}
          role="tab"
          aria-selected={tab === "users"}
        >
          Users
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {tab === "pending" ? (
        <div className="admin-tab-panel" role="tabpanel">
          {verificationQuery.isLoading ? <p>Loading…</p> : null}
          {pending.length === 0 && !verificationQuery.isLoading ? (
            <p className="muted">No pending verification requests.</p>
          ) : null}
          <div className="admin-verification-list">
            {pending.map((request) => (
              <PendingRequestCard
                key={request.id}
                request={request}
                notes={notesByRequestId[request.id] ?? ""}
                onNotesChange={(v) => setNoteFor(request.id, v)}
                disabled={reviewMutation.isPending}
                onApprove={() => reviewMutation.mutate({ requestId: request.id, status: "approved" })}
                onReject={() => reviewMutation.mutate({ requestId: request.id, status: "rejected" })}
              />
            ))}
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="admin-tab-panel" role="tabpanel">
          <p className="muted">
            Chronological log of verification decisions, manual verified badge changes, and user access blocks. New events require the{" "}
            <code className="small-mono">admin_audit_events</code> table (see repo migration).
          </p>
          {reviewTimelineQuery.data?.warning ? <p className="error">{reviewTimelineQuery.data.warning}</p> : null}
          {reviewTimelineQuery.isLoading ? <p>Loading…</p> : null}
          {reviewTimelineQuery.isError ? (
            <p className="error">{(reviewTimelineQuery.error as Error).message}</p>
          ) : null}
          <ul className="list">
            {(reviewTimelineQuery.data?.items ?? []).map((row) => (
              <ReviewTimelineRow key={row.id} item={row} />
            ))}
          </ul>
          {!reviewTimelineQuery.isLoading &&
          !reviewTimelineQuery.isError &&
          (reviewTimelineQuery.data?.items ?? []).length === 0 ? (
            <p className="muted">No history yet.</p>
          ) : null}
        </div>
      ) : null}

      {tab === "trainers" ? (
        <div className="admin-tab-panel" role="tabpanel">
          <p className="muted">
            Toggle <strong>verified</strong> for <strong>trainers</strong> and <strong>nutritionists</strong> (same account type; we detect nutritionists from specialty text containing
            &quot;nutri&quot;). This is separate from the verification request queue; use for overrides.
          </p>
          <div
            className="admin-tabs"
            style={{ marginTop: "0.5rem", marginBottom: "0.8rem" }}
            role="tablist"
            aria-label="Trainers and nutritionists"
          >
            <button
              type="button"
              className={trainerView === "all" ? "admin-tab active" : "admin-tab"}
              onClick={() => setTrainerView("all")}
            >
              All
              <span className="admin-tab-count">{allTrainers.length}</span>
            </button>
            <button
              type="button"
              className={trainerView === "nutritionists" ? "admin-tab active" : "admin-tab"}
              onClick={() => setTrainerView("nutritionists")}
            >
              Nutritionists
              <span className="admin-tab-count">{nutritionists.length}</span>
            </button>
            <button
              type="button"
              className={trainerView === "other" ? "admin-tab active" : "admin-tab"}
              onClick={() => setTrainerView("other")}
            >
              Trainers
              <span className="admin-tab-count">{fitnessTrainers.length}</span>
            </button>
          </div>
          {trainersQuery.isLoading ? <p>Loading…</p> : null}
          <ul className="list">
            {visibleTrainers.map((t) => (
              <TrainerRow
                key={t.id}
                trainer={t}
                busy={trainerVerifiedMutation.isPending}
                onSetVerified={(verified) => trainerVerifiedMutation.mutate({ trainerId: t.id, verified })}
              />
            ))}
          </ul>
          {!trainersQuery.isLoading && visibleTrainers.length === 0 ? (
            <p className="muted">
              {trainerView === "nutritionists"
                ? "No nutritionist profiles match (put “nutri” in specialty, e.g. “nutritionist”)."
                : trainerView === "other"
                  ? "No other trainer profiles in this list."
                  : "No trainer or nutritionist profiles yet."}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="admin-tab-panel" role="tabpanel">
          <p className="muted">
            <strong>Block access</strong> signs the user out of the API (existing tokens stop working). Admins and your own account cannot be changed from here.
          </p>
          {usersQuery.isLoading ? <p>Loading users…</p> : null}
          {usersQuery.isError ? <p className="error">{(usersQuery.error as Error).message}</p> : null}
          <ul className="list">
            {(usersQuery.data ?? []).map((u) => (
              <UserRow
                key={u.id}
                user={u}
                currentUserId={user.id}
                busy={accessMutation.isPending}
                onSetSuspended={(suspended) => accessMutation.mutate({ userId: u.id, suspended })}
              />
            ))}
          </ul>
          {!usersQuery.isLoading && !usersQuery.isError && (usersQuery.data ?? []).length === 0 ? (
            <p className="muted">No users found.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ReviewTimelineRow({ item }: { item: AdminReviewTimelineItem }) {
  const d = item.detail;
  const actor = item.actor?.email ?? item.actor?.full_name ?? "System";
  const lines: string[] = [];
  if (d.outcome != null) lines.push(`Outcome: ${String(d.outcome)}`);
  if (d.trainer_id != null) lines.push(`Trainer profile: ${String(d.trainer_id)}`);
  if (d.admin_notes) lines.push(`Admin notes: ${String(d.admin_notes)}`);
  if (d.credential_url) {
    const url = String(d.credential_url);
    lines.push(`Credential: ${url.slice(0, 80)}${url.length > 80 ? "…" : ""}`);
  }
  if (d.target_email) lines.push(`User: ${String(d.target_email)}`);
  if (d.target_role) lines.push(`Role: ${String(d.target_role)}`);
  if (typeof d.access_suspended === "boolean") lines.push(`Access suspended: ${d.access_suspended ? "yes" : "no"}`);
  if (d.profile_email) lines.push(`Profile email: ${String(d.profile_email)}`);
  if (typeof d.verified === "boolean") lines.push(`Verified flag: ${d.verified ? "on" : "off"}`);
  if (d.note) lines.push(String(d.note));

  return (
    <li className="admin-history-row">
      <div>
        <div className="admin-history-meta">
          <b>{timelineActionLabel(item.action)}</b>
          <span className="muted"> · {formatDate(item.at)}</span>
        </div>
        <p className="muted small-mono">
          {item.source === "legacy_verification" ? "Legacy" : "Audit"} · {item.target_type} · {item.target_id}
        </p>
        <p className="muted">By {actor}</p>
        {lines.length > 0 ? (
          <ul className="admin-timeline-detail">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function UserRow({
  user,
  currentUserId,
  busy,
  onSetSuspended,
}: {
  user: { id: string; email: string; full_name: string | null; role: string; created_at: string; access_suspended?: boolean };
  currentUserId: string;
  busy: boolean;
  onSetSuspended: (suspended: boolean) => void;
}) {
  const isSelf = user.id === currentUserId;
  const isAdmin = user.role === "admin";
  const suspended = user.access_suspended === true;
  return (
    <li className="admin-history-row">
      <div className="admin-user-main">
        <div>
          <b>{user.role}</b> — {user.full_name ?? "Unnamed"} <span className="muted">({user.email})</span>
        </div>
        <p className="muted small-mono" style={{ margin: "0.2rem 0" }}>
          {user.id} · {formatDate(user.created_at)}
        </p>
        {suspended ? <span className="badge" style={{ background: "#fee2e2", color: "#991b1b" }}>Access blocked</span> : null}
      </div>
      <div className="admin-user-actions">
        {isSelf || isAdmin ? (
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {isSelf ? "You" : "Admin accounts"}
          </span>
        ) : (
          <div className="inline-actions">
            {suspended ? (
              <button
                type="button"
                className="primary-btn"
                disabled={busy}
                onClick={() => onSetSuspended(false)}
              >
                Restore access
              </button>
            ) : (
              <button
                type="button"
                className="secondary-btn"
                style={{ color: "#991b1b", borderColor: "#fecaca" }}
                disabled={busy}
                onClick={() => onSetSuspended(true)}
              >
                Block access
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function TrainerRow({
  trainer,
  busy,
  onSetVerified,
}: {
  trainer: AdminTrainer;
  busy: boolean;
  onSetVerified: (verified: boolean) => void;
}) {
  const p = trainer.profiles;
  const asNutritionist = isNutritionistBySpecialty(trainer.specialty);
  return (
    <li className="admin-history-row">
      <div>
        <div className="admin-trainer-name-row">
          <b>{p?.full_name ?? "Unnamed"}</b> <span className="muted">({p?.email})</span>
          <span className={asNutritionist ? "badge badge-success" : "badge badge-muted"} style={{ marginLeft: "0.4rem" }}>
            {asNutritionist ? "Nutritionist" : "Trainer"}
          </span>
        </div>
        <p className="muted small-mono" style={{ margin: "0.2rem 0" }}>
          Profile {trainer.id} · user {trainer.user_id}
        </p>
        <p className="muted">{(trainer.specialty ?? "General") + ` · $${trainer.hourly_rate}/hr`}</p>
        <span className={trainer.verified ? "badge badge-success" : "badge badge-muted"}>
          {trainer.verified ? "Verified" : "Not verified"}
        </span>
      </div>
      <div className="admin-user-actions">
        <div className="inline-actions">
          {trainer.verified ? (
            <button type="button" className="secondary-btn" disabled={busy} onClick={() => onSetVerified(false)}>
              Revoke verified
            </button>
          ) : (
            <button type="button" className="primary-btn" disabled={busy} onClick={() => onSetVerified(true)}>
              Mark verified
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function PendingRequestCard({
  request,
  notes,
  onNotesChange,
  disabled,
  onApprove,
  onReject,
}: {
  request: VerificationRequest;
  notes: string;
  onNotesChange: (v: string) => void;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className="card admin-pending-card">
      <div className="section-head" style={{ marginBottom: "0.5rem" }}>
        <h3 className="admin-card-title">Verification request</h3>
        <span className="badge badge-muted">Pending</span>
      </div>
      <p className="muted small-mono">ID: {request.id}</p>
      <p className="muted">Profile: {request.trainer_id}</p>
      <p className="muted">Submitted: {formatDate(request.submitted_at)}</p>
      <p>
        <a href={request.credential_url} target="_blank" rel="noreferrer" className="secondary-link">
          Open credential
        </a>
      </p>
      <label htmlFor={`admin-notes-${request.id}`}>Admin notes (this request only)</label>
      <textarea
        id={`admin-notes-${request.id}`}
        rows={3}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Internal notes for this decision (optional)"
        disabled={disabled}
      />
      <div className="inline-actions">
        <button type="button" className="primary-btn" disabled={disabled} onClick={onApprove}>
          Approve
        </button>
        <button type="button" className="secondary-btn" disabled={disabled} onClick={onReject}>
          Reject
        </button>
      </div>
    </article>
  );
}
