import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createBooking, getBookings, getOpenSlots, payBooking } from "../services/bookings";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

export function BookingPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [trainerId, setTrainerId] = useState("");
  const [fromDate, setFromDate] = useState("2026-04-27");
  const [toDate, setToDate] = useState("2026-05-04");
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const [error, setError] = useState("");

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const openSlotsQuery = useQuery({
    queryKey: ["open-slots", trainerId, fromDate, toDate],
    queryFn: () => getOpenSlots(trainerId, fromDate, toDate),
    enabled: Boolean(trainerId && fromDate && toDate),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBooking(token, {
        trainerId,
        bookingDate: selectedSlot?.date ?? fromDate,
        startTime: selectedSlot?.startTime ?? "10:00:00",
        endTime: selectedSlot?.endTime ?? "11:00:00",
        notes: "Booked from VaultFit web app",
      }),
    onSuccess: () => {
      setError("");
      setSelectedSlot(null);
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["open-slots", trainerId, fromDate, toDate] });
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
  const openSlots = openSlotsQuery.data ?? [];
  const slotLabel = useMemo(
    () => (selectedSlot ? `${selectedSlot.date} ${selectedSlot.startTime}-${selectedSlot.endTime}` : "None selected"),
    [selectedSlot],
  );

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
        <div className="row-grid">
          <div>
            <label>From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
        <p className="muted">Selected slot: {slotLabel}</p>
        <div className="slot-list">
          {openSlotsQuery.isLoading ? <p className="muted">Loading open slots...</p> : null}
          {openSlots.map((slot, idx) => (
            <button
              key={`${slot.date}-${slot.startTime}-${idx}`}
              className={`secondary-btn slot-btn ${
                selectedSlot &&
                selectedSlot.date === slot.date &&
                selectedSlot.startTime === slot.startTime &&
                selectedSlot.endTime === slot.endTime
                  ? "slot-btn-active"
                  : ""
              }`}
              onClick={() => setSelectedSlot(slot)}
            >
              {slot.date} {slot.startTime}-{slot.endTime}
            </button>
          ))}
        </div>
        <button
          className="primary-btn"
          disabled={!trainerId || !selectedSlot || createMutation.isPending}
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
