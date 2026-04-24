import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getBookings } from "../services/bookings";
import { createPlan, deletePlan, getPlans, updatePlan } from "../services/plans";
import { useAuth } from "../state/auth-context";

export function PlansPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [planType, setPlanType] = useState<"fitness" | "nutrition" | "hybrid">("fitness");
  const [contentText, setContentText] = useState('{"weeks":[{"week":1,"days":[]}]}');
  const [error, setError] = useState("");

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => getPlans(token),
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const clientIds = Array.from(
    new Set((bookingsQuery.data ?? []).map((b) => b.client_id).filter((id): id is string => Boolean(id))),
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      let content: unknown;
      try {
        content = JSON.parse(contentText);
      } catch {
        throw new Error("Plan content must be valid JSON");
      }
      return createPlan(token, { clientId, title, planType, content });
    },
    onSuccess: () => {
      setError("");
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e) => {
      setError((e as Error).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (planId: string) => deletePlan(token, planId),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e) => {
      setError((e as Error).message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (planId: string) => updatePlan(token, planId, { title: `${title || "Updated"} (edited)` }),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <section>
      <h2>Plans</h2>

      {user?.role === "trainer" || user?.role === "admin" ? (
        <div className="card">
          <h3>Create Plan</h3>
          <p className="muted">Create structured plans for clients.</p>

          <label>Client ID</label>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client profile UUID" />
          {clientIds.length > 0 ? (
            <select onChange={(e) => setClientId(e.target.value)} value={clientId}>
              <option value="">Select client from your bookings</option>
              {clientIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          ) : null}

          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="4-week strength plan" />

          <label>Plan type</label>
          <select value={planType} onChange={(e) => setPlanType(e.target.value as "fitness" | "nutrition" | "hybrid")}>
            <option value="fitness">fitness</option>
            <option value="nutrition">nutrition</option>
            <option value="hybrid">hybrid</option>
          </select>

          <label>Content JSON</label>
          <textarea value={contentText} onChange={(e) => setContentText(e.target.value)} rows={6} />

          <button
            className="primary-btn"
            disabled={!clientId || !title || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Creating..." : "Create plan"}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </div>
      ) : null}

      <div className="card">
        <h3>Your Plans</h3>
        {plansQuery.isLoading ? <p>Loading plans...</p> : null}
        <ul className="list">
          {(plansQuery.data ?? []).map((plan) => (
            <li key={plan.id}>
              <span>
                <b>{plan.title}</b> ({plan.plan_type})
              </span>
              {user?.role === "trainer" || user?.role === "admin" ? (
                <div className="inline-actions">
                  <button
                    className="secondary-btn"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate(plan.id)}
                  >
                    Quick edit
                  </button>
                  <button
                    className="secondary-btn"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(plan.id)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
