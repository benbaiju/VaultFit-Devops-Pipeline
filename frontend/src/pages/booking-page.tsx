import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createBooking, getBookings, getOpenSlots, payBooking } from "../services/bookings";
import { getServices } from "../services/services";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

export function BookingPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [trainerId, setTrainerId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [availabilityMode, setAvailabilityMode] = useState<"single" | "range">("single");
  const [dayDate, setDayDate] = useState("2026-04-27");
  const [fromDate, setFromDate] = useState("2026-04-27");
  const [toDate, setToDate] = useState("2026-05-04");
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const [error, setError] = useState("");
  const queryFrom = availabilityMode === "single" ? dayDate : fromDate;
  const queryTo = availabilityMode === "single" ? dayDate : toDate;

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const verifiedTrainers = useMemo(
    () => (trainersQuery.data ?? []).filter((trainer) => trainer.verified),
    [trainersQuery.data],
  );

  const servicesByTrainer = useQueries({
    queries: verifiedTrainers.map((trainer) => ({
      queryKey: ["services", trainer.id],
      queryFn: () => getServices(trainer.id),
      enabled: Boolean(trainer.id),
    })),
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const openSlotsQuery = useQuery({
    queryKey: ["open-slots", trainerId, selectedServiceId, availabilityMode, queryFrom, queryTo],
    queryFn: () => getOpenSlots(trainerId, selectedServiceId, queryFrom, queryTo),
    enabled: Boolean(trainerId && selectedServiceId && queryFrom && queryTo),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBooking(token, {
        trainerId,
        serviceId: selectedServiceId,
        bookingDate: selectedSlot?.date ?? fromDate,
        startTime: selectedSlot?.startTime ?? "10:00:00",
        endTime: selectedSlot?.endTime ?? "11:00:00",
        notes: "Booked from VaultFit web app",
      }),
    onSuccess: () => {
      setError("");
      setSelectedSlot(null);
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({
        queryKey: ["open-slots", trainerId, selectedServiceId, availabilityMode, queryFrom, queryTo],
      });
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

  const servicesLoading = servicesByTrainer.some((query) => query.isLoading);
  const servicesError = servicesByTrainer.find((query) => query.isError)?.error;
  const serviceOptions = useMemo(
    () =>
      servicesByTrainer.flatMap((query, index) => {
        const trainer = verifiedTrainers[index];
        if (!trainer) return [];
        return (query.data ?? [])
          .filter((service) => service.is_active)
          .map((service) => ({
            ...service,
            trainerName: trainer.profiles?.full_name ?? "Unnamed Trainer",
          }));
      }),
    [servicesByTrainer, verifiedTrainers],
  );
  const selectedService = useMemo(
    () => serviceOptions.find((service) => service.id === selectedServiceId) ?? null,
    [selectedServiceId, serviceOptions],
  );
  const bookings = bookingsQuery.data ?? [];
  const openSlots = openSlotsQuery.data ?? [];
  const slotsByDate = useMemo(() => {
    return openSlots.reduce<Record<string, typeof openSlots>>((acc, slot) => {
      acc[slot.date] = acc[slot.date] ? [...acc[slot.date], slot] : [slot];
      return acc;
    }, {});
  }, [openSlots]);
  const orderedSlotDates = useMemo(() => Object.keys(slotsByDate).sort((a, b) => a.localeCompare(b)), [slotsByDate]);
  const slotLabel = useMemo(
    () => (selectedSlot ? `${selectedSlot.date} ${selectedSlot.startTime}-${selectedSlot.endTime}` : "None selected"),
    [selectedSlot],
  );

  function handleServiceChange(value: string) {
    setSelectedServiceId(value);
    const service = serviceOptions.find((option) => option.id === value);
    setTrainerId(service?.trainer_id ?? "");
    setSelectedSlot(null);
  }

  return (
    <section>
      <h2>Book a session</h2>
      <div className="card">
        <h3>Choose service and slot</h3>
        <p className="muted">Pick a session/service first, then choose an open time for that trainer.</p>
        <label>Service</label>
        <select value={selectedServiceId} onChange={(e) => handleServiceChange(e.target.value)}>
          <option value="">Select service</option>
          {serviceOptions.map((service) => (
            <option key={service.id} value={service.id}>
              {service.title} - {service.trainerName} - ${service.price} ({service.duration_minutes} min)
            </option>
          ))}
        </select>
        {servicesLoading ? <p className="muted">Loading services...</p> : null}
        {servicesError ? <p className="error">{(servicesError as Error).message}</p> : null}
        {selectedService ? (
          <p className="muted">
            Selected: {selectedService.title} by {selectedService.trainerName} (${selectedService.price})
          </p>
        ) : null}
        <label>Availability view</label>
        <div className="booking-mode-toggle">
          <button
            type="button"
            className={`secondary-btn mode-toggle-btn ${availabilityMode === "single" ? "mode-toggle-active" : ""}`}
            onClick={() => {
              setAvailabilityMode("single");
              setSelectedSlot(null);
            }}
          >
            Single day
          </button>
          <button
            type="button"
            className={`secondary-btn mode-toggle-btn ${availabilityMode === "range" ? "mode-toggle-active" : ""}`}
            onClick={() => {
              setAvailabilityMode("range");
              setSelectedSlot(null);
            }}
          >
            Date range plan
          </button>
        </div>
        {availabilityMode === "single" ? (
          <div>
            <label>Date</label>
            <input type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} />
          </div>
        ) : (
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
        )}
        <p className="muted">Selected slot: {slotLabel}</p>
        <div className="slot-list">
          {openSlotsQuery.isLoading ? <p className="muted">Loading open slots...</p> : null}
          {!openSlotsQuery.isLoading && selectedService && openSlots.length === 0 ? (
            <p className="muted">No availability configured for this service in the selected date range.</p>
          ) : null}
          {orderedSlotDates.map((date) => (
            <div key={date} className="slot-date-group">
              <p className="slot-date-title">{date}</p>
              <div className="slot-date-grid">
                {(slotsByDate[date] ?? []).map((slot, idx) => (
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
                    {slot.startTime.slice(0, 5)}-{slot.endTime.slice(0, 5)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          className="primary-btn"
          disabled={!selectedService || !trainerId || !selectedSlot || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Creating..." : "Create booking"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="card">
        <h3>Your sessions</h3>
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
