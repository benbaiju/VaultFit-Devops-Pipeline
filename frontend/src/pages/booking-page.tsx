import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createBooking, getBookings, payBooking } from "../services/bookings";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

export function BookingPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [trainerId, setTrainerId] = useState("");
  const [error, setError] = useState("");

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBooking(token, {
        trainerId,
        bookingDate: "2026-04-27",
        startTime: "10:00:00",
        endTime: "11:00:00",
        notes: "Booked from VaultFit web app",
      }),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => {
      setError((e as Error).message);
    },
  });

  const payMutation = useMutation({
    mutationFn: (bookingId: string) => payBooking(token, bookingId),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => {
      setError((e as Error).message);
    },
  });

  const trainers = trainersQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];

  return (
    <section>
      <h2>Bookings</h2>
      <div className="card">
        <h3>Create Booking</h3>
        <p className="muted">Select a trainer and create a session booking.</p>
        <label>Trainer</label>
        <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
          <option value="">Select trainer</option>
          {trainers.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.profiles?.full_name ?? trainer.id}
            </option>
          ))}
        </select>
        <button
          className="primary-btn"
          disabled={!trainerId || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Creating..." : "Create booking"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="card">
        <h3>Your bookings</h3>
        {bookingsQuery.isLoading ? <p>Loading bookings...</p> : null}
        <ul className="list">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <span>
                {booking.booking_date} {booking.start_time}-{booking.end_time} |{" "}
                <b className={`status status-${booking.status}`}>{booking.status}</b>
              </span>
              {booking.status === "pending" ? (
                <button
                  className="secondary-btn"
                  disabled={payMutation.isPending}
                  onClick={() => payMutation.mutate(booking.id)}
                >
                  Pay mock
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
