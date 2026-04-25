import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getBookings } from "../services/bookings";
import { createPlan, deletePlan, getPlans, updatePlan } from "../services/plans";
import { getServices } from "../services/services";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

export function PlansPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [planType, setPlanType] = useState<"fitness" | "nutrition" | "hybrid">("fitness");
  const [contentText, setContentText] = useState('{"weeks":[{"week":1,"days":[]}]}');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => getPlans(token),
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });
  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
    enabled: user?.role === "client",
  });

  const clientIds = Array.from(
    new Set((bookingsQuery.data ?? []).map((b) => b.client_id).filter((id): id is string => Boolean(id))),
  );
  const clientBookings = (bookingsQuery.data ?? []).filter((b) => b.client_id === user?.id);
  const serviceTrainerIds = useMemo(
    () => Array.from(new Set(clientBookings.map((b) => b.trainer_id).filter((id): id is string => Boolean(id)))),
    [clientBookings],
  );
  const servicesByTrainer = useQueries({
    queries: serviceTrainerIds.map((trainerId) => ({
      queryKey: ["services", trainerId],
      queryFn: () => getServices(trainerId),
      enabled: Boolean(trainerId) && user?.role === "client",
    })),
  });
  const serviceById = useMemo(() => {
    const services = new Map<string, { title: string; durationMinutes: number; price: number; serviceType: string }>();
    servicesByTrainer.forEach((query) => {
      (query.data ?? []).forEach((service) => {
        services.set(service.id, {
          title: service.title,
          durationMinutes: service.duration_minutes,
          price: service.price,
          serviceType: service.service_type,
        });
      });
    });
    return services;
  }, [servicesByTrainer]);
  const trainerNameById = useMemo(() => {
    const names = new Map<string, string>();
    (trainersQuery.data ?? []).forEach((trainer) => {
      names.set(trainer.id, trainer.profiles?.full_name ?? "Trainer");
    });
    return names;
  }, [trainersQuery.data]);
  const upcomingBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return clientBookings.filter((booking) => new Date(`${booking.booking_date}T00:00:00`) >= today);
  }, [clientBookings]);
  const pastBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return clientBookings.filter((booking) => new Date(`${booking.booking_date}T00:00:00`) < today);
  }, [clientBookings]);

  function formatTimeWindow(start: string, end: string): string {
    return `${start.slice(0, 5)}-${end.slice(0, 5)}`;
  }

  function renderBookingItem(booking: (typeof clientBookings)[number]) {
    const service = booking.service_id ? serviceById.get(booking.service_id) : undefined;
    return (
      <li key={booking.id} className="booking-item">
        <button
          type="button"
          className="booking-item-toggle"
          onClick={() => setExpandedBookingId((prev) => (prev === booking.id ? null : booking.id))}
        >
          <div className="booking-item-main">
            <div>
              <p className="booking-item-title">{service?.title ?? "Session"}</p>
              <p className="booking-item-subtitle">
                {booking.booking_date} | {formatTimeWindow(booking.start_time, booking.end_time)} | Trainer:{" "}
                {booking.trainer_id ? (trainerNameById.get(booking.trainer_id) ?? "Trainer") : "Trainer"}
              </p>
            </div>
            <div className="booking-item-right">
              <span className={`badge booking-status-badge booking-status-${booking.status}`}>{booking.status}</span>
              <span className="booking-item-link">{expandedBookingId === booking.id ? "Hide details" : "View details"}</span>
            </div>
          </div>
        </button>
        {expandedBookingId === booking.id ? (
          <div className="booking-details-grid">
            <p className="muted">
              <strong>Type:</strong> {service?.serviceType ?? "N/A"}
            </p>
            <p className="muted">
              <strong>Duration:</strong> {service?.durationMinutes ? `${service.durationMinutes} min` : "N/A"}
            </p>
            <p className="muted">
              <strong>Price:</strong> {typeof service?.price === "number" ? `$${service.price}` : "N/A"}
            </p>
            <p className="muted">
              <strong>Trainer:</strong>{" "}
              {booking.trainer_id ? (trainerNameById.get(booking.trainer_id) ?? "Trainer") : "Trainer"}
            </p>
            <p className="muted booking-id-line">
              <strong>Booking Ref:</strong> {booking.id}
            </p>
          </div>
        ) : null}
      </li>
    );
  }

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
      <h2>{user?.role === "client" ? "My plans" : "Plans"}</h2>

      {user?.role === "trainer" ? (
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
        {!plansQuery.isLoading && (plansQuery.data ?? []).length === 0 ? (
          <p className="muted">
            {user?.role === "client"
              ? "No trainer-authored plans yet. Your booked services are listed below."
              : "No plans yet."}
          </p>
        ) : null}
        <ul className="list">
          {(plansQuery.data ?? []).map((plan) => (
            <li key={plan.id}>
              <span>
                <b>{plan.title}</b> ({plan.plan_type})
              </span>
              {user?.role === "trainer" ? (
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

      {user?.role === "client" ? (
        <div className="card">
          <h3>Booked services</h3>
          {bookingsQuery.isLoading ? <p>Loading booked services...</p> : null}
          {!bookingsQuery.isLoading && clientBookings.length === 0 ? (
            <p className="muted">No booked services yet.</p>
          ) : null}
          {upcomingBookings.length > 0 ? (
            <>
              <p className="booking-section-title">Upcoming ({upcomingBookings.length})</p>
              <ul className="list">{upcomingBookings.map(renderBookingItem)}</ul>
            </>
          ) : null}
          {pastBookings.length > 0 ? (
            <>
              <p className="booking-section-title">Past ({pastBookings.length})</p>
              <ul className="list">{pastBookings.map(renderBookingItem)}</ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
