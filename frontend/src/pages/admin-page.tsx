import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getAdminUsers,
  getAdminVerificationRequests,
  reviewVerificationRequest,
} from "../services/verification";
import { useAuth } from "../state/auth-context";

export function AdminPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState("");
  const [error, setError] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getAdminUsers(token),
    enabled: user?.role === "admin",
  });

  const verificationQuery = useQuery({
    queryKey: ["admin-verification-requests"],
    queryFn: () => getAdminVerificationRequests(token),
    enabled: user?.role === "admin",
  });

  const reviewMutation = useMutation({
    mutationFn: (params: { requestId: string; status: "approved" | "rejected" }) =>
      reviewVerificationRequest(token, params.requestId, { status: params.status, adminNotes }),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["admin-verification-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["trainers"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => setError((e as Error).message),
  });

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
      <h2>Admin</h2>
      <div className="card">
        <h3>Verification Requests</h3>
        <label>Admin notes (applied to next approve/reject click)</label>
        <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3} />
        {verificationQuery.isLoading ? <p>Loading verification requests...</p> : null}
        <ul className="list">
          {(verificationQuery.data ?? []).map((request) => (
            <li key={request.id}>
              <span>
                <b>{request.status.toUpperCase()}</b> - {request.id} - {request.credential_url}
              </span>
              <div className="inline-actions">
                <button
                  className="secondary-btn"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ requestId: request.id, status: "approved" })}
                >
                  Approve
                </button>
                <button
                  className="secondary-btn"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ requestId: request.id, status: "rejected" })}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Users</h3>
        {usersQuery.isLoading ? <p>Loading users...</p> : null}
        <ul className="list">
          {(usersQuery.data ?? []).map((u) => (
            <li key={u.id}>
              <span>
                <b>{u.role}</b> - {u.full_name ?? "Unnamed"} ({u.email})
              </span>
            </li>
          ))}
        </ul>
      </div>

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
