import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getAdminUsers, setUserAccess } from "../services/verification";
import { useAuth } from "../state/auth-context";

export function AdminUsersPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getAdminUsers(token),
    enabled: user?.role === "admin",
  });

  const accessMutation = useMutation({
    mutationFn: (params: { userId: string; suspended: boolean }) => setUserAccess(token, params.userId, params.suspended),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-review-timeline"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  if (user?.role !== "admin") {
    return (
      <section className="admin-surface-section">
        <h2 className="admin-page-title">Users</h2>
        <p className="error">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="admin-surface-section">
      <h2 className="admin-page-title">Users</h2>
      <p className="muted admin-page-lead">
        <strong>Block access</strong> signs the user out of the API (existing tokens stop working). Admins and your own account cannot be changed from here.
      </p>

      {error ? <p className="error">{error}</p> : null}

      {usersQuery.isLoading ? <p className="admin-muted-text">Loading users…</p> : null}
      {usersQuery.isError ? <p className="error">{(usersQuery.error as Error).message}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role &amp; details</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(usersQuery.data ?? []).map((u) => {
              const isSelf = u.id === user.id;
              const isAdminRole = u.role === "admin";
              const suspended = u.access_suspended === true;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="admin-cell-strong">{u.full_name ?? "Unnamed"}</div>
                    <div className="admin-cell-sub">{u.email}</div>
                  </td>
                  <td>
                    <span className="admin-badge admin-badge--muted">{u.role}</span>
                    <div className="admin-cell-mono">{u.id}</div>
                  </td>
                  <td>
                    {suspended ? (
                      <span className="admin-badge admin-badge--danger">Blocked</span>
                    ) : (
                      <span className="admin-badge admin-badge--success">Active</span>
                    )}
                  </td>
                  <td>
                    {isSelf || isAdminRole ? (
                      <span className="admin-muted-text">{isSelf ? "You" : "Admin"}</span>
                    ) : suspended ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        disabled={accessMutation.isPending}
                        onClick={() => accessMutation.mutate({ userId: u.id, suspended: false })}
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost-danger"
                        disabled={accessMutation.isPending}
                        onClick={() => accessMutation.mutate({ userId: u.id, suspended: true })}
                      >
                        Block
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!usersQuery.isLoading && !usersQuery.isError && (usersQuery.data ?? []).length === 0 ? (
        <p className="admin-muted-text">No users found.</p>
      ) : null}
    </section>
  );
}
