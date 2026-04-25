import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createAvailability,
  createBlockedDate,
  deleteAvailability,
  deleteBlockedDate,
  getAvailability,
  getBlockedDates,
} from "../services/availability";
import { createService, deleteService, getServices, updateService } from "../services/services";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function ServicesPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [serviceType, setServiceType] = useState<"session" | "program" | "consultation">("session");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [price, setPrice] = useState(90);
  const [draftDayOfWeek, setDraftDayOfWeek] = useState(0);
  const [draftStartTime, setDraftStartTime] = useState("09:00");
  const [draftEndTime, setDraftEndTime] = useState("17:00");
  const [draftBlockedDate, setDraftBlockedDate] = useState("");
  const [draftBlockedReason, setDraftBlockedReason] = useState("");
  const [draftAvailability, setDraftAvailability] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>([]);
  const [draftBlockedDates, setDraftBlockedDates] = useState<Array<{ blockedDate: string; reason?: string }>>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [blockedDate, setBlockedDate] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [error, setError] = useState("");

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const trainers = trainersQuery.data ?? [];

  const effectiveTrainerId = useMemo(() => {
    if (user?.role !== "trainer") return "";
    const mine = trainers.find((t) => t.user_id === user.id);
    return mine?.id ?? "";
  }, [trainers, user?.id, user?.role]);

  const servicesQuery = useQuery({
    queryKey: ["services", effectiveTrainerId],
    queryFn: () => getServices(effectiveTrainerId),
    enabled: Boolean(effectiveTrainerId),
  });
  const availabilityQuery = useQuery({
    queryKey: ["availability", effectiveTrainerId, selectedServiceId],
    queryFn: () => getAvailability(effectiveTrainerId, selectedServiceId),
    enabled: Boolean(effectiveTrainerId && selectedServiceId),
  });
  const blockedDatesQuery = useQuery({
    queryKey: ["blocked-dates", effectiveTrainerId, selectedServiceId],
    queryFn: () => getBlockedDates(effectiveTrainerId, selectedServiceId),
    enabled: Boolean(effectiveTrainerId && selectedServiceId),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await createService(token, effectiveTrainerId, {
        title,
        serviceType,
        durationMinutes,
        price,
        isActive: true,
      });
      for (const slot of draftAvailability) {
        await createAvailability(token, effectiveTrainerId, {
          serviceId: created.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
      for (const blocked of draftBlockedDates) {
        await createBlockedDate(token, effectiveTrainerId, {
          serviceId: created.id,
          blockedDate: blocked.blockedDate,
          reason: blocked.reason,
        });
      }
      return created;
    },
    onSuccess: () => {
      setError("");
      setTitle("");
      setDraftAvailability([]);
      setDraftBlockedDates([]);
      void queryClient.invalidateQueries({ queryKey: ["services", effectiveTrainerId] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const toggleMutation = useMutation({
    mutationFn: (params: { serviceId: string; isActive: boolean }) =>
      updateService(token, effectiveTrainerId, params.serviceId, { isActive: !params.isActive }),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["services", effectiveTrainerId] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (serviceId: string) => deleteService(token, effectiveTrainerId, serviceId),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["services", effectiveTrainerId] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const createAvailabilityMutation = useMutation({
    mutationFn: () =>
      createAvailability(token, effectiveTrainerId, {
        serviceId: selectedServiceId,
        dayOfWeek,
        startTime,
        endTime,
      }),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["availability", effectiveTrainerId, selectedServiceId] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const deleteAvailabilityMutation = useMutation({
    mutationFn: (slotId: string) => deleteAvailability(token, effectiveTrainerId, slotId),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["availability", effectiveTrainerId, selectedServiceId] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const createBlockedDateMutation = useMutation({
    mutationFn: () =>
      createBlockedDate(token, effectiveTrainerId, {
        serviceId: selectedServiceId,
        blockedDate,
        reason: blockedReason.trim() || undefined,
      }),
    onSuccess: () => {
      setError("");
      setBlockedDate("");
      setBlockedReason("");
      void queryClient.invalidateQueries({ queryKey: ["blocked-dates", effectiveTrainerId, selectedServiceId] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const deleteBlockedDateMutation = useMutation({
    mutationFn: (blockedDateId: string) => deleteBlockedDate(token, effectiveTrainerId, blockedDateId),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["blocked-dates", effectiveTrainerId, selectedServiceId] });
    },
    onError: (e) => setError((e as Error).message),
  });

  function addDraftAvailability() {
    if (draftStartTime >= draftEndTime) {
      setError("Start time must be before end time for availability.");
      return;
    }
    setError("");
    setDraftAvailability((prev) => [...prev, { dayOfWeek: draftDayOfWeek, startTime: draftStartTime, endTime: draftEndTime }]);
  }

  function addDraftBlockedDate() {
    if (!draftBlockedDate) return;
    setError("");
    setDraftBlockedDates((prev) => [
      ...prev,
      {
        blockedDate: draftBlockedDate,
        reason: draftBlockedReason.trim() || undefined,
      },
    ]);
    setDraftBlockedDate("");
    setDraftBlockedReason("");
  }

  return (
    <section>
      <h2>Your services</h2>

      <div className="card">
        <h3>Create Service</h3>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="60-min online PT session" />
        <label>Type</label>
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value as "session" | "program" | "consultation")}>
          <option value="session">session</option>
          <option value="program">program</option>
          <option value="consultation">consultation</option>
        </select>
        <label>Duration (minutes)</label>
        <input
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          min={15}
        />
        <label>Price (AUD)</label>
        <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min={0} />
        <h4>Availability for this service</h4>
        <div className="row-grid">
          <div>
            <label>Day</label>
            <select value={draftDayOfWeek} onChange={(e) => setDraftDayOfWeek(Number(e.target.value))}>
              {DAY_LABELS.map((label, idx) => (
                <option key={label} value={idx}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Start time</label>
            <input type="time" value={draftStartTime} onChange={(e) => setDraftStartTime(e.target.value)} />
          </div>
          <div>
            <label>End time</label>
            <input type="time" value={draftEndTime} onChange={(e) => setDraftEndTime(e.target.value)} />
          </div>
        </div>
        <button className="secondary-btn" type="button" onClick={addDraftAvailability}>
          Add slot to draft
        </button>
        <ul className="list">
          {draftAvailability.map((slot, idx) => (
            <li key={`${slot.dayOfWeek}-${slot.startTime}-${idx}`}>
              <span>
                {DAY_LABELS[slot.dayOfWeek]} {slot.startTime} - {slot.endTime}
              </span>
            </li>
          ))}
        </ul>
        <h4>Exceptions for this service</h4>
        <label>Blocked date</label>
        <input type="date" value={draftBlockedDate} onChange={(e) => setDraftBlockedDate(e.target.value)} />
        <label>Reason (optional)</label>
        <input value={draftBlockedReason} onChange={(e) => setDraftBlockedReason(e.target.value)} placeholder="Leave day" />
        <button className="secondary-btn" type="button" onClick={addDraftBlockedDate}>
          Add blocked date to draft
        </button>
        <ul className="list">
          {draftBlockedDates.map((entry, idx) => (
            <li key={`${entry.blockedDate}-${idx}`}>
              <span>
                {entry.blockedDate}
                {entry.reason ? ` (${entry.reason})` : ""}
              </span>
            </li>
          ))}
        </ul>
        <button
          className="primary-btn"
          disabled={!effectiveTrainerId || !title || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Publishing..." : "Publish service"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="card">
        <h3>Manage service schedule</h3>
        <label>Service</label>
        <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}>
          <option value="">Select service</option>
          {(servicesQuery.data ?? []).map((service) => (
            <option key={service.id} value={service.id}>
              {service.title}
            </option>
          ))}
        </select>
        <p className="muted">Clients can only book inside these slots for the selected service.</p>
        <div className="row-grid">
          <div>
            <label>Day</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAY_LABELS.map((label, idx) => (
                <option key={label} value={idx}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Start time</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <label>End time</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <button
          className="primary-btn"
          disabled={!effectiveTrainerId || !selectedServiceId || createAvailabilityMutation.isPending}
          onClick={() => createAvailabilityMutation.mutate()}
        >
          {createAvailabilityMutation.isPending ? "Saving..." : "Add availability slot"}
        </button>
        {availabilityQuery.isLoading ? <p className="muted">Loading availability...</p> : null}
        <ul className="list">
          {(availabilityQuery.data ?? []).map((slot) => (
            <li key={slot.id}>
              <span>
                {DAY_LABELS[slot.day_of_week]} {slot.start_time} - {slot.end_time}
              </span>
              <button
                className="secondary-btn"
                disabled={deleteAvailabilityMutation.isPending}
                onClick={() => deleteAvailabilityMutation.mutate(slot.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Blocked dates</h3>
        <p className="muted">Mark one-off dates unavailable (holidays, leave, etc.).</p>
        <label>Date</label>
        <input type="date" value={blockedDate} onChange={(e) => setBlockedDate(e.target.value)} />
        <label>Reason (optional)</label>
        <input value={blockedReason} onChange={(e) => setBlockedReason(e.target.value)} placeholder="Public holiday" />
        <button
          className="primary-btn"
          disabled={!effectiveTrainerId || !selectedServiceId || !blockedDate || createBlockedDateMutation.isPending}
          onClick={() => createBlockedDateMutation.mutate()}
        >
          {createBlockedDateMutation.isPending ? "Saving..." : "Add blocked date"}
        </button>
        {blockedDatesQuery.isLoading ? <p className="muted">Loading blocked dates...</p> : null}
        <ul className="list">
          {(blockedDatesQuery.data ?? []).map((entry) => (
            <li key={entry.id}>
              <span>
                {entry.blocked_date}
                {entry.reason ? ` (${entry.reason})` : ""}
              </span>
              <button
                className="secondary-btn"
                disabled={deleteBlockedDateMutation.isPending}
                onClick={() => deleteBlockedDateMutation.mutate(entry.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Existing Services</h3>
        {servicesQuery.isLoading ? <p>Loading services...</p> : null}
        <ul className="list">
          {(servicesQuery.data ?? []).map((service) => (
            <li key={service.id}>
              <span>
                <b>{service.title}</b> ({service.service_type}) - {service.duration_minutes}m - ${service.price}
                <span className={`badge ${service.is_active ? "badge-success" : "badge-muted"}`}>
                  {service.is_active ? "Active" : "Inactive"}
                </span>
              </span>
              <div className="inline-actions">
                <button
                  className="secondary-btn"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ serviceId: service.id, isActive: service.is_active })}
                >
                  {service.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  className="secondary-btn"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(service.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
