import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
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
type ServicesSection = "create" | "schedule" | "blocked-dates" | "existing";

export function ServicesPage() {
  const { token, user } = useAuth();
  const location = useLocation();
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
  const [isDraftDayMenuOpen, setIsDraftDayMenuOpen] = useState(false);
  const [isManageDayMenuOpen, setIsManageDayMenuOpen] = useState(false);
  const [error, setError] = useState("");

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const trainers = trainersQuery.data ?? [];

  const effectiveTrainerId = useMemo(() => {
    if (user?.role !== "trainer" && user?.role !== "nutritionist") return "";
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
  const services = servicesQuery.data ?? [];
  const activeServicesCount = services.filter((service) => service.is_active).length;
  const pausedServicesCount = services.length - activeServicesCount;
  const section: ServicesSection = location.pathname.endsWith("/schedule")
    ? "schedule"
    : location.pathname.endsWith("/blocked-dates")
      ? "blocked-dates"
      : location.pathname.endsWith("/existing")
        ? "existing"
        : "create";

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

  function renderDayMenu(value: number, onSelect: (next: number) => void, open: boolean, setOpen: (next: boolean) => void) {
    return (
      <div className="day-menu">
        <button type="button" className="secondary-btn day-menu-trigger" onClick={() => setOpen(!open)}>
          <span>{DAY_LABELS[value]}</span>
          <span className={`day-menu-caret ${open ? "day-menu-caret-open" : ""}`} aria-hidden>
            ▾
          </span>
        </button>
        {open ? (
          <div className="day-menu-list">
            {DAY_LABELS.map((label, idx) => (
              <button
                key={label}
                type="button"
                className={`day-menu-item ${idx === value ? "day-menu-item-active" : ""}`}
                onClick={() => {
                  onSelect(idx);
                  setOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section>
      <h2>Your services</h2>

      <div className="card services-quick-nav">
        <div className="services-quick-nav-head">
          <h3>Quick Navigate</h3>
          <details className="services-quick-nav-mobile">
            <summary>Menu</summary>
            <div className="services-quick-nav-mobile-list">
              <Link className={`secondary-btn services-nav-link ${section === "create" ? "services-nav-link-active" : ""}`} to={ROUTES.trainer.servicesCreate}>
                Create Service
              </Link>
              <Link className={`secondary-btn services-nav-link ${section === "schedule" ? "services-nav-link-active" : ""}`} to={ROUTES.trainer.servicesSchedule}>
                Schedule
              </Link>
              <Link className={`secondary-btn services-nav-link ${section === "blocked-dates" ? "services-nav-link-active" : ""}`} to={ROUTES.trainer.servicesBlockedDates}>
                Blocked Dates
              </Link>
              <Link className={`secondary-btn services-nav-link ${section === "existing" ? "services-nav-link-active" : ""}`} to={ROUTES.trainer.servicesExisting}>
                Existing Services
              </Link>
            </div>
          </details>
        </div>
        <div className="services-quick-nav-buttons">
          <Link className={`secondary-btn services-nav-link ${section === "create" ? "services-nav-link-active" : ""}`} to={ROUTES.trainer.servicesCreate}>
            Create Service
          </Link>
          <Link className={`secondary-btn services-nav-link ${section === "schedule" ? "services-nav-link-active" : ""}`} to={ROUTES.trainer.servicesSchedule}>
            Schedule
          </Link>
          <Link className={`secondary-btn services-nav-link ${section === "blocked-dates" ? "services-nav-link-active" : ""}`} to={ROUTES.trainer.servicesBlockedDates}>
            Blocked Dates
          </Link>
          <Link className={`secondary-btn services-nav-link ${section === "existing" ? "services-nav-link-active" : ""}`} to={ROUTES.trainer.servicesExisting}>
            Existing Services
          </Link>
        </div>
      </div>

      {section === "create" ? (
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
            {renderDayMenu(draftDayOfWeek, setDraftDayOfWeek, isDraftDayMenuOpen, setIsDraftDayMenuOpen)}
          </div>
          <div>
            <label>Start time</label>
            <div className="time-input-wrap">
              <input type="time" value={draftStartTime} onChange={(e) => setDraftStartTime(e.target.value)} />
              <span className="time-input-caret" aria-hidden>
                ▾
              </span>
            </div>
          </div>
        </div>
        <div>
          <label>End time</label>
          <div className="time-input-wrap">
            <input type="time" value={draftEndTime} onChange={(e) => setDraftEndTime(e.target.value)} />
            <span className="time-input-caret" aria-hidden>
              ▾
            </span>
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
      ) : null}

      {section === "schedule" ? (
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
            {renderDayMenu(dayOfWeek, setDayOfWeek, isManageDayMenuOpen, setIsManageDayMenuOpen)}
          </div>
          <div>
            <label>Start time</label>
            <div className="time-input-wrap">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <span className="time-input-caret" aria-hidden>
                ▾
              </span>
            </div>
          </div>
        </div>
        <div>
          <label>End time</label>
          <div className="time-input-wrap">
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            <span className="time-input-caret" aria-hidden>
              ▾
            </span>
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
      ) : null}

      {section === "blocked-dates" ? (
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
      ) : null}

      {section === "existing" ? (
      <div className="card">
        <h3>Existing Services</h3>
        {!servicesQuery.isLoading ? (
          <p className="muted">
            Total {services.length} | Live {activeServicesCount} | Paused {pausedServicesCount}
          </p>
        ) : null}
        {servicesQuery.isLoading ? <p>Loading services...</p> : null}
        <ul className="list">
          {services.map((service) => (
            <li key={service.id} className="service-list-item">
              <span className="service-list-main">
                <b>{service.title}</b>
                <span className="muted service-list-meta">
                  {service.service_type} · {service.duration_minutes} min · ${service.price}
                </span>
                <span className={`badge service-status-badge ${service.is_active ? "service-status-live" : "service-status-paused"}`}>
                  {service.is_active ? "Live" : "Paused"}
                </span>
                <span className="muted service-status-copy">
                  {service.is_active ? "Visible to clients and bookable" : "Hidden from client booking"}
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
      ) : null}

      <style>{`
        .services-quick-nav {
          position: static;
          z-index: 8;
          backdrop-filter: blur(10px);
          background: rgba(9, 14, 31, 0.92);
          border: 1px solid var(--border-light);
          border-radius: 16px;
          padding: 0.9rem;
        }
        .services-quick-nav-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.6rem;
        }
        .services-quick-nav-head h3 {
          margin: 0;
        }
        .services-quick-nav-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .services-nav-link {
          text-decoration: none;
          border-radius: 999px;
          padding: 0.5rem 1rem;
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .services-nav-link-active {
          border-color: var(--primary);
          box-shadow: inset 0 0 0 1px var(--primary);
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(99, 102, 241, 0.18));
          color: #fff;
        }
        .day-menu {
          position: relative;
          margin-bottom: 1.25rem;
        }
        .day-menu-trigger {
          width: 100%;
          justify-content: space-between;
          padding-right: 0.8rem;
        }
        .day-menu-caret {
          color: var(--text-secondary);
          font-size: 0.8rem;
          transition: transform 0.2s ease;
        }
        .day-menu-caret-open {
          transform: rotate(180deg);
        }
        .time-input-wrap {
          position: relative;
        }
        .time-input-wrap input {
          padding-right: 2.2rem;
          margin-bottom: 1.25rem;
        }
        .time-input-caret {
          position: absolute;
          right: 0.8rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
          font-size: 0.78rem;
          pointer-events: none;
        }
        .day-menu-list {
          position: absolute;
          top: calc(100% + 0.35rem);
          left: 0;
          right: 0;
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          background: rgba(8, 12, 26, 0.98);
          backdrop-filter: blur(8px);
          box-shadow: var(--shadow-lg);
          padding: 0.4rem;
          z-index: 20;
          display: grid;
          gap: 0.25rem;
        }
        .day-menu-item {
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-primary);
          border-radius: var(--radius-sm);
          justify-content: flex-start;
          padding: 0.55rem 0.7rem;
        }
        .day-menu-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--border-light);
        }
        .day-menu-item-active {
          background: rgba(79, 70, 229, 0.16);
          border-color: rgba(99, 102, 241, 0.45);
          color: #fff;
        }
        .services-quick-nav-mobile {
          display: none;
        }
        .services-quick-nav-mobile summary {
          cursor: pointer;
          user-select: none;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .services-quick-nav-mobile-list {
          margin-top: 0.55rem;
          display: grid;
          gap: 0.4rem;
        }
        @media (max-width: 820px) {
          .services-quick-nav { padding: 0.75rem; }
          .services-quick-nav-buttons {
            display: none;
          }
          .services-quick-nav-mobile {
            display: block;
          }
        }
      `}</style>
    </section>
  );
}
