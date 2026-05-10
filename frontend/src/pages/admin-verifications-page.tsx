import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  getAdminReviewTimeline,
  getAdminTrainers,
  getAdminUsers,
  getVerificationDocumentUrlByType,
  getAdminVerificationRequests,
  reviewVerificationRequest,
  setTrainerVerifiedState,
  setUserAccess,
} from "../services/verification";
import { useAuth } from "../state/auth-context";
import type { AdminTrainer, VerificationRequest } from "../types/api";

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

export function AdminVerificationsPage() {
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

  async function openCredential(requestId: string, type: "credential" | "identity", currentRef: string | null | undefined) {
    try {
      const ref = (currentRef ?? "").trim();
      if (!ref) {
        throw new Error(`${type} document is not available for this request.`);
      }
      const direct = ref.startsWith("http://") || ref.startsWith("https://");
      if (direct) {
        window.open(ref, "_blank", "noopener,noreferrer");
        return;
      }
      const doc = await getVerificationDocumentUrlByType(token, requestId, type);
      window.open(doc.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
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
    <section className="admin-surface-section">
      <h2 className="admin-page-title">Verifications</h2>
      <p className="muted admin-page-lead">
        Review verification requests, set verified for trainers and nutritionists, and manage review history.
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
                onOpenCredential={() => void openCredential(request.id, "credential", request.credential_url)}
                onOpenIdentity={() => void openCredential(request.id, "identity", request.identity_url)}
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
            Chronological log of verification decisions, manual verified badge changes, and user access blocks.
          </p>
          {reviewTimelineQuery.data?.warning ? <p className="error">{reviewTimelineQuery.data.warning}</p> : null}
          {reviewTimelineQuery.isLoading ? <p>Loading…</p> : null}
          {reviewTimelineQuery.isError ? (
            <p className="error">{(reviewTimelineQuery.error as Error).message}</p>
          ) : null}
          
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Actor</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(reviewTimelineQuery.data?.items ?? []).map((row) => {
                  const actor = row.actor?.email ?? row.actor?.full_name ?? "System";
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="font-medium">{timelineActionLabel(row.action)}</span>
                        {row.detail.admin_notes != null && String(row.detail.admin_notes).trim() !== "" ? (
                          <span className="block text-xs muted mt-1">{String(row.detail.admin_notes)}</span>
                        ) : null}
                      </td>
                      <td>
                        <div className="small-mono">{row.target_type}</div>
                        <div className="text-xs muted">{row.target_id}</div>
                      </td>
                      <td>{actor}</td>
                      <td className="muted text-sm">{formatDate(row.at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
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
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role & Details</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(usersQuery.data ?? []).map((u) => {
                  const isSelf = u.id === user.id;
                  const isAdmin = u.role === "admin";
                  const suspended = u.access_suspended === true;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="font-medium">{u.full_name ?? "Unnamed"}</div>
                        <div className="text-xs muted">{u.email}</div>
                      </td>
                      <td>
                        <div className="badge badge-muted mb-1">{u.role}</div>
                        <div className="small-mono">{u.id}</div>
                      </td>
                      <td>
                        {suspended ? <span className="badge badge-danger">Blocked</span> : <span className="badge badge-success">Active</span>}
                      </td>
                      <td>
                        {isSelf || isAdmin ? (
                          <span className="muted text-sm">{isSelf ? "You" : "Admin"}</span>
                        ) : (
                          suspended ? (
                            <button
                              type="button"
                              className="primary-btn"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                              disabled={accessMutation.isPending}
                              onClick={() => accessMutation.mutate({ userId: u.id, suspended: false })}
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="secondary-btn"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                              disabled={accessMutation.isPending}
                              onClick={() => accessMutation.mutate({ userId: u.id, suspended: true })}
                            >
                              Block
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!usersQuery.isLoading && !usersQuery.isError && (usersQuery.data ?? []).length === 0 ? (
            <p className="muted">No users found.</p>
          ) : null}
        </div>
      ) : null}
    </section>
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
  onOpenCredential,
  onOpenIdentity,
  onApprove,
  onReject,
}: {
  request: VerificationRequest;
  notes: string;
  onNotesChange: (v: string) => void;
  disabled: boolean;
  onOpenCredential: () => void;
  onOpenIdentity: () => void;
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
      <div className="inline-actions">
        <button type="button" className="secondary-btn" onClick={onOpenCredential} disabled={disabled}>
          Open credential
        </button>
        <button type="button" className="secondary-btn" onClick={onOpenIdentity} disabled={disabled}>
          Open identity
        </button>
      </div>
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
