import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getBookings, updateBookingStatus } from "../services/bookings";
import { useAuth } from "../state/auth-context";
import type { Booking } from "../types/api";

const NEXT_STATUS: Partial<Record<Booking["status"], Booking["status"][]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
};

export function TrainerBookingsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Booking["status"] }) => updateBookingStatus(token, id, status),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const bookings = bookingsQuery.data ?? [];

  return (
    <section>
      <h2>Session requests</h2>
      <p className="muted">Bookings where you are the trainer. Update status as sessions progress.</p>
      {bookingsQuery.isLoading ? <p>Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <ul className="list">
        {bookings.map((b) => (
          <li key={b.id}>
            <div>
              <span>
                {b.booking_date} {b.start_time}–{b.end_time} · <b className={`status status-${b.status}`}>{b.status}</b>
              </span>
              <p className="muted">Client session</p>
              <div className="inline-actions">
                {(NEXT_STATUS[b.status] ?? []).map((next) => (
                  <button
                    key={next}
                    type="button"
                    className="secondary-btn"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ id: b.id, status: next })}
                  >
                    Mark {next}
                  </button>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!bookingsQuery.isLoading && bookings.length === 0 ? <p className="muted">No bookings yet.</p> : null}
    </section>
  );
}
