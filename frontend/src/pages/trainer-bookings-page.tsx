import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getYear,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ROUTES } from "../lib/navigation";
import { getBookings, updateBookingStatus } from "../services/bookings";
import { getServices } from "../services/services";
import { getMyTrainerProfile } from "../services/trainers";
import { useAuth } from "../state/auth-context";
import type { Booking } from "../types/api";

const TRAINER_NEXT_STATUS: Partial<Record<Booking["status"], Booking["status"][]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
};

/** Clients may cancel their own bookings (API allows client or trainer). */
const CLIENT_NEXT_STATUS: Partial<Record<Booking["status"], Booking["status"][]>> = {
  pending: ["cancelled"],
  confirmed: ["cancelled"],
};

const HOUR_START = 9;
const HOUR_END = 20;
const ROW_H = 44;

type CalView = "day" | "week" | "month" | "year";

function timeToMinutes(t: string): number {
  const [h = 0, m = 0] = t.split(":").map((x) => Number.parseInt(x, 10));
  return h * 60 + m;
}

function maxOverlapping(bookings: Booking[]): number {
  if (bookings.length === 0) return 1;
  type Pt = { t: number; d: number };
  const pts: Pt[] = [];
  for (const b of bookings) {
    pts.push({ t: timeToMinutes(b.start_time), d: 1 });
    pts.push({ t: timeToMinutes(b.end_time), d: -1 });
  }
  pts.sort((a, b) => (a.t === b.t ? b.d - a.d : a.t - b.t));
  let cur = 0;
  let max = 0;
  for (const p of pts) {
    cur += p.d;
    max = Math.max(max, cur);
  }
  return Math.max(max, 1);
}

function laneAssignment(bookings: Booking[]): Map<string, number> {
  const sorted = [...bookings].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  const laneEnd: number[] = [];
  const map = new Map<string, number>();
  for (const b of sorted) {
    const s = timeToMinutes(b.start_time);
    const e = timeToMinutes(b.end_time);
    let lane = laneEnd.findIndex((end) => s >= end);
    if (lane === -1) {
      lane = laneEnd.length;
      laneEnd.push(e);
    } else {
      laneEnd[lane] = e;
    }
    map.set(b.id, lane);
  }
  return map;
}

function bookingBlockStyle(
  b: Booking,
  lane: number,
  lanes: number,
): { top: number; height: number; leftPct: number; widthPct: number } {
  const startMin = timeToMinutes(b.start_time);
  const endMin = timeToMinutes(b.end_time);
  const gridStartMin = HOUR_START * 60;
  const gridEndMin = (HOUR_END + 1) * 60;
  const clampedStart = Math.max(startMin, gridStartMin);
  const clampedEnd = Math.min(Math.max(endMin, clampedStart + 15), gridEndMin);
  const top = ((clampedStart - gridStartMin) / 60) * ROW_H;
  const height = Math.max(((clampedEnd - clampedStart) / 60) * ROW_H, 44);
  const widthPct = 100 / lanes;
  const leftPct = lane * widthPct;
  return { top, height, leftPct, widthPct };
}

export type BookingsCalendarVariant = "trainer" | "client";

export function BookingsCalendarPage({ variant }: { variant: BookingsCalendarVariant }) {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [view, setView] = useState<CalView>("week");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
    enabled: variant === "trainer" && Boolean(token),
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const trainerId = meQuery.data?.id;

  const servicesQuery = useQuery({
    queryKey: ["services", trainerId],
    queryFn: () => getServices(trainerId!),
    enabled: variant === "trainer" && Boolean(trainerId),
  });

  const clientTrainerIds = useMemo(() => {
    if (variant !== "client" || !user?.id) return [];
    const list = bookingsQuery.data ?? [];
    const mine = list.filter((b) => b.client_id === user.id);
    return [...new Set(mine.map((b) => b.trainer_id).filter((id): id is string => Boolean(id)))];
  }, [variant, user?.id, bookingsQuery.data]);

  const clientServicesQueries = useQueries({
    queries: clientTrainerIds.map((tid) => ({
      queryKey: ["services", tid],
      queryFn: () => getServices(tid),
      enabled: variant === "client" && Boolean(tid),
    })),
  });

  const allClientServices = useMemo(
    () => clientServicesQueries.flatMap((q) => q.data ?? []),
    [clientServicesQueries],
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Booking["status"] }) => updateBookingStatus(token, id, status),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const titleByServiceId = useMemo(() => {
    const m = new Map<string, string>();
    if (variant === "trainer") {
      for (const s of servicesQuery.data ?? []) {
        m.set(s.id, s.title);
      }
    } else {
      for (const s of allClientServices) {
        m.set(s.id, s.title);
      }
    }
    return m;
  }, [variant, servicesQuery.data, allClientServices]);

  const displayBookings = useMemo(() => {
    const list = bookingsQuery.data ?? [];
    if (variant === "trainer") {
      if (!trainerId) return [];
      return list.filter((b) => b.trainer_id === trainerId);
    }
    if (!user?.id) return [];
    return list.filter((b) => b.client_id === user.id);
  }, [bookingsQuery.data, variant, trainerId, user?.id]);

  const weekStart = useMemo(() => startOfWeek(cursorDate, { weekStartsOn: 1 }), [cursorDate]);
  const weekEnd = useMemo(() => endOfWeek(cursorDate, { weekStartsOn: 1 }), [cursorDate]);

  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const rangeLabel = useMemo(() => {
    if (view === "day") {
      return format(cursorDate, "EEEE, MMM d, yyyy");
    }
    if (view === "week") {
      return isSameMonth(weekStart, weekEnd)
        ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "d, yyyy")}`
        : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
    }
    if (view === "month") {
      return format(cursorDate, "MMMM yyyy");
    }
    return format(cursorDate, "yyyy");
  }, [cursorDate, view, weekStart, weekEnd]);

  function goToday() {
    setCursorDate(new Date());
  }

  function goPrev() {
    if (view === "day") setCursorDate((d) => addDays(d, -1));
    else if (view === "week") setCursorDate((d) => addWeeks(d, -1));
    else if (view === "month") setCursorDate((d) => addMonths(d, -1));
    else setCursorDate((d) => addYears(d, -1));
  }

  function goNext() {
    if (view === "day") setCursorDate((d) => addDays(d, 1));
    else if (view === "week") setCursorDate((d) => addWeeks(d, 1));
    else if (view === "month") setCursorDate((d) => addMonths(d, 1));
    else setCursorDate((d) => addYears(d, 1));
  }

  const hourRows = useMemo(() => {
    const rows: number[] = [];
    for (let h = HOUR_START; h <= HOUR_END; h += 1) rows.push(h);
    return rows;
  }, []);

  const gridBodyHeight = hourRows.length * ROW_H;

  const selectedBooking = useMemo(
    () => displayBookings.find((b) => b.id === selectedId) ?? null,
    [displayBookings, selectedId],
  );

  const yearSummaries = useMemo(() => {
    const y = getYear(cursorDate);
    const months: { monthIndex: number; label: string; count: number }[] = [];
    for (let m = 0; m < 12; m += 1) {
      const count = displayBookings.filter((b) => {
        const d = parseISO(b.booking_date);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === m;
      }).length;
      months.push({ monthIndex: m, label: format(new Date(y, m, 1), "MMMM"), count });
    }
    return months;
  }, [cursorDate, displayBookings]);

  function bookingsForDay(day: Date): Booking[] {
    return displayBookings.filter((b) => {
      try {
        return isSameDay(parseISO(b.booking_date), day);
      } catch {
        return false;
      }
    });
  }

  function sessionLabel(b: Booking): string {
    const title = b.service_id ? titleByServiceId.get(b.service_id) : undefined;
    return title?.trim() || "Session";
  }

  function formatTimeRange(b: Booking): string {
    return `${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`;
  }

  function personLabel(booking: Booking): string {
    if (variant === "client") {
      return booking.trainer_display_name?.trim() || "Trainer";
    }
    return booking.client_display_name?.trim() || "Client";
  }

  const loading = bookingsQuery.isLoading || (variant === "trainer" && meQuery.isLoading);

  const nextStatusMap = variant === "client" ? CLIENT_NEXT_STATUS : TRAINER_NEXT_STATUS;

  return (
    <section className="tb-bookings">
      <header className="tb-bookings-head">
        <h2 className="tb-bookings-title">Bookings</h2>
        <p className="muted tb-bookings-lead">
          {variant === "client"
            ? "Your sessions on the calendar. Select a block to view details or cancel if plans change."
            : "Your sessions on the calendar. Select a block to update status."}
        </p>
      </header>

      <div className="tb-cal-toolbar">
        <button type="button" className="tb-cal-today" onClick={goToday}>
          Today
        </button>
        <div className="tb-cal-nav">
          <button type="button" className="tb-cal-round" aria-label="Previous" onClick={goPrev}>
            <ChevronLeft size={18} />
          </button>
          <span className="tb-cal-range">{rangeLabel}</span>
          <button type="button" className="tb-cal-round" aria-label="Next" onClick={goNext}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="tb-cal-views" role="tablist" aria-label="Calendar view">
          {(["year", "month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`tb-cal-view-btn ${view === v ? "tb-cal-view-btn--active" : ""}`}
              onClick={() => setView(v)}
            >
              {v.slice(0, 1).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="error tb-cal-error">{error}</p> : null}

      {loading ? (
        <p className="muted">Loading calendar…</p>
      ) : (
        <>
          {view === "year" ? (
            <div className="tb-year-grid">
              {yearSummaries.map(({ monthIndex, label, count }) => (
                <button
                  key={monthIndex}
                  type="button"
                  className="tb-year-cell"
                  onClick={() => {
                    setCursorDate(new Date(getYear(cursorDate), monthIndex, 1));
                    setView("month");
                  }}
                >
                  <span className="tb-year-month">{label}</span>
                  <span className="tb-year-count">{count} booking{count === 1 ? "" : "s"}</span>
                </button>
              ))}
            </div>
          ) : null}

          {view === "month" ? (
            <MonthGrid
              cursorDate={cursorDate}
              bookings={displayBookings}
              onPickDay={(d) => {
                setCursorDate(d);
                setView("day");
              }}
            />
          ) : null}

          {(view === "week" || view === "day") && (
            <div className="tb-cal-scroll">
              <div
                className="tb-cal-grid"
                style={{
                  gridTemplateColumns:
                    view === "day" ? `52px minmax(0,1fr)` : `52px repeat(7, minmax(0, 1fr))`,
                  gridTemplateRows: `auto ${gridBodyHeight}px`,
                }}
              >
                <div className="tb-cal-corner" style={{ gridColumn: 1, gridRow: 1 }} />
                {(view === "week" ? weekDays : [cursorDate]).map((day, i) => (
                  <div
                    key={format(day, "yyyy-MM-dd")}
                    className="tb-cal-col-head"
                    style={{ gridColumn: i + 2, gridRow: 1 }}
                  >
                    <span className="tb-cal-dow">{format(day, "EEE")}</span>
                    <span className={`tb-cal-dom ${isSameDay(day, new Date()) ? "tb-cal-dom--today" : ""}`}>
                      {format(day, "d")}
                    </span>
                  </div>
                ))}

                <div className="tb-cal-hours" style={{ gridColumn: 1, gridRow: 2, height: gridBodyHeight }}>
                  {hourRows.map((h) => (
                    <div key={h} className="tb-cal-hour" style={{ height: ROW_H }}>
                      {String(h).padStart(2, "0")}
                    </div>
                  ))}
                </div>

                {(view === "week" ? weekDays : [cursorDate]).map((day, i) => {
                  const dayBookings = bookingsForDay(day);
                  const lanes = maxOverlapping(dayBookings);
                  const lanesMap = laneAssignment(dayBookings);
                  return (
                    <div
                      key={`col-${format(day, "yyyy-MM-dd")}`}
                      className="tb-cal-col"
                      style={{ gridColumn: i + 2, gridRow: 2, height: gridBodyHeight }}
                    >
                      <div className="tb-cal-grid-lines" aria-hidden>
                        {hourRows.map((h) => (
                          <div key={h} className="tb-cal-grid-line" style={{ height: ROW_H }} />
                        ))}
                      </div>
                      {dayBookings.map((b) => {
                        const lane = lanesMap.get(b.id) ?? 0;
                        const pos = bookingBlockStyle(b, lane, lanes);
                        const summary = `${formatTimeRange(b)}, ${sessionLabel(b)}, ${personLabel(b)}`;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            className={`tb-cal-event tb-cal-event--${b.status} ${selectedId === b.id ? "tb-cal-event--selected" : ""}`}
                            style={{
                              top: pos.top,
                              height: pos.height,
                              left: `${pos.leftPct}%`,
                              width: `${pos.widthPct}%`,
                            }}
                            title={summary}
                            aria-label={`Booking: ${summary}. ${b.status}.`}
                            onClick={() => setSelectedId(b.id === selectedId ? null : b.id)}
                          >
                            <span className="tb-cal-event-time">{formatTimeRange(b)}</span>
                            <span className="tb-cal-event-title">{sessionLabel(b)}</span>
                            <span className="tb-cal-event-person">{personLabel(b)}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {selectedBooking ? (
        <div className="tb-cal-detail card">
          <div className="tb-cal-detail-row">
            <strong>
              {selectedBooking.booking_date} · {formatTimeRange(selectedBooking)}
            </strong>
            <span className={`status status-${selectedBooking.status}`}>{selectedBooking.status}</span>
          </div>
          <p className="tb-cal-detail-service">{sessionLabel(selectedBooking)}</p>
          <p className="muted tb-cal-detail-person">
            {variant === "client" ? (
              <>
                Trainer:{" "}
                {selectedBooking.trainer_id ? (
                  <Link
                    className="tb-cal-detail-link"
                    to={`${ROUTES.client.trainers}/${selectedBooking.trainer_id}`}
                  >
                    {personLabel(selectedBooking)}
                  </Link>
                ) : (
                  personLabel(selectedBooking)
                )}
              </>
            ) : (
              <>
                Client: {personLabel(selectedBooking)}
              </>
            )}
          </p>
          <div className="inline-actions">
            {(nextStatusMap[selectedBooking.status] ?? []).map((next) => (
              <button
                key={next}
                type="button"
                className="secondary-btn"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: selectedBooking.id, status: next })}
              >
                {variant === "client" && next === "cancelled" ? "Cancel booking" : `Mark ${next}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && displayBookings.length === 0 ? (
        <p className="muted tb-cal-empty">
          {variant === "client" ? (
            <>
              No bookings yet.{" "}
              <Link to={ROUTES.client.book}>Book a session</Link> to see it on your calendar.
            </>
          ) : (
            <>No bookings yet. Once clients book your services, they appear here.</>
          )}
        </p>
      ) : null}

      <style>{`
        .tb-bookings {
          max-width: 1180px;
          margin: 0 auto;
        }
        .tb-bookings-head {
          margin-bottom: 1rem;
        }
        .tb-bookings-title {
          margin: 0 0 0.35rem;
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text-primary);
        }
        .tb-bookings-lead {
          margin: 0;
          max-width: 40rem;
        }
        .tb-cal-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.75rem;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding: 0.65rem 0.85rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.03);
        }
        .tb-cal-today {
          padding: 0.45rem 0.9rem;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.88rem;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
          cursor: pointer;
        }
        .tb-cal-today:hover {
          color: #fff;
          border-color: rgba(56, 189, 248, 0.45);
        }
        .tb-cal-nav {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        .tb-cal-round {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .tb-cal-round:hover {
          color: #fff;
          border-color: rgba(56, 189, 248, 0.45);
        }
        .tb-cal-range {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text-primary);
          min-width: 12rem;
          text-align: center;
        }
        .tb-cal-views {
          display: inline-flex;
          gap: 0.25rem;
          flex-wrap: wrap;
        }
        .tb-cal-view-btn {
          padding: 0.35rem 0.65rem;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
        }
        .tb-cal-view-btn:hover {
          color: var(--text-secondary);
        }
        .tb-cal-view-btn--active {
          background: rgba(79, 70, 229, 0.2);
          border-color: rgba(79, 70, 229, 0.35);
          color: #fff;
        }
        .tb-cal-error {
          margin-bottom: 0.75rem;
        }
        .tb-cal-scroll {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: rgba(15, 23, 42, 0.45);
        }
        .tb-cal-grid {
          display: grid;
          min-width: min(100%, 920px);
          border-collapse: collapse;
        }
        .tb-cal-corner {
          border-bottom: 1px solid var(--border-color);
        }
        .tb-cal-col-head {
          text-align: center;
          padding: 0.5rem 0.25rem;
          border-bottom: 1px solid var(--border-color);
          border-left: 1px solid var(--border-color);
        }
        .tb-cal-dow {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .tb-cal-dom {
          display: block;
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .tb-cal-dom--today {
          color: #38bdf8;
        }
        .tb-cal-hours {
          border-right: 1px solid var(--border-color);
        }
        .tb-cal-hour {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          padding-right: 0.35rem;
          text-align: right;
          box-sizing: border-box;
          border-top: 1px solid rgba(148, 163, 184, 0.15);
        }
        .tb-cal-hour:first-child {
          border-top: none;
        }
        .tb-cal-col {
          position: relative;
          border-left: 1px solid var(--border-color);
          box-sizing: border-box;
        }
        .tb-cal-grid-lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .tb-cal-grid-line {
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          box-sizing: border-box;
        }
        .tb-cal-grid-line:first-child {
          border-top: none;
        }
        .tb-cal-event {
          position: absolute;
          box-sizing: border-box;
          padding: 0.25rem 0.35rem;
          margin: 0 2px;
          border-radius: 8px;
          text-align: left;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: rgba(56, 189, 248, 0.25);
          border: 1px solid rgba(56, 189, 248, 0.55);
          background: rgba(56, 189, 248, 0.12);
          color: #e0f2fe;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 0.1rem;
          z-index: 3;
          font-size: 0.78rem;
          line-height: 1.2;
        }
        .tb-cal-event:hover {
          border-color: rgba(125, 211, 252, 0.85);
          background: rgba(56, 189, 248, 0.2);
        }
        .tb-cal-event--selected {
          border-color: rgba(129, 140, 248, 0.95);
          box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.35);
        }
        .tb-cal-event--pending {
          border-style: dashed;
        }
        .tb-cal-event--cancelled {
          opacity: 0.55;
          border-color: rgba(148, 163, 184, 0.45);
        }
        .tb-cal-event-time {
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .tb-cal-event-title {
          font-weight: 600;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.15;
        }
        .tb-cal-event-person {
          font-size: 0.68rem;
          font-weight: 500;
          color: rgba(224, 242, 254, 0.88);
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .tb-year-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 0.65rem;
          margin-bottom: 1rem;
        }
        .tb-year-cell {
          padding: 0.85rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.03);
          cursor: pointer;
          text-align: left;
          color: inherit;
        }
        .tb-year-cell:hover {
          border-color: rgba(56, 189, 248, 0.45);
        }
        .tb-year-month {
          display: block;
          font-weight: 700;
          font-size: 0.95rem;
          margin-bottom: 0.25rem;
        }
        .tb-year-count {
          font-size: 0.82rem;
          color: var(--text-muted);
        }
        .tb-cal-detail {
          margin-top: 1rem;
        }
        .tb-cal-detail-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 0.35rem;
        }
        .tb-cal-detail-service {
          margin: 0 0 0.25rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .tb-cal-detail-person {
          margin: 0 0 0.75rem;
          font-size: 0.92rem;
        }
        .tb-cal-detail-link {
          color: #7dd3fc;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .tb-cal-detail-link:hover {
          color: #bae6fd;
        }
        .tb-cal-empty {
          margin-top: 1rem;
        }
      `}</style>
    </section>
  );
}

export function TrainerBookingsPage() {
  return <BookingsCalendarPage variant="trainer" />;
}

function MonthGrid(props: {
  cursorDate: Date;
  bookings: Booking[];
  onPickDay: (d: Date) => void;
}) {
  const { cursorDate, bookings, onPickDay } = props;
  const monthStart = startOfMonth(cursorDate);
  const monthEnd = endOfMonth(cursorDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bookings) {
      const k = b.booking_date;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [bookings]);

  const weekDaysHeader = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="tb-month-wrap">
      <div className="tb-month-dows">
        {weekDaysHeader.map((w) => (
          <div key={w} className="tb-month-dow">
            {w}
          </div>
        ))}
      </div>
      <div className="tb-month-cells">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, cursorDate);
          const n = countByDay.get(key) ?? 0;
          return (
            <button
              key={key}
              type="button"
              className={`tb-month-cell ${inMonth ? "" : "tb-month-cell--muted"} ${isSameDay(day, new Date()) ? "tb-month-cell--today" : ""}`}
              onClick={() => onPickDay(day)}
            >
              <span className="tb-month-num">{format(day, "d")}</span>
              {n > 0 ? <span className="tb-month-dot">{n}</span> : null}
            </button>
          );
        })}
      </div>
      <style>{`
        .tb-month-wrap {
          margin-bottom: 1rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          overflow: hidden;
          background: rgba(15, 23, 42, 0.35);
        }
        .tb-month-dows {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0;
          border-bottom: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.03);
        }
        .tb-month-dow {
          text-align: center;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          padding: 0.45rem 0;
          text-transform: uppercase;
        }
        .tb-month-cells {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
        }
        .tb-month-cell {
          min-height: 64px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          padding: 0.35rem;
          background: transparent;
          cursor: pointer;
          color: inherit;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
          position: relative;
        }
        .tb-month-cell:hover {
          background: rgba(56, 189, 248, 0.08);
        }
        .tb-month-cell--muted .tb-month-num {
          opacity: 0.35;
        }
        .tb-month-cell--today .tb-month-num {
          color: #38bdf8;
          font-weight: 800;
        }
        .tb-month-num {
          font-size: 0.9rem;
          font-weight: 600;
        }
        .tb-month-dot {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.1rem 0.35rem;
          border-radius: 999px;
          background: rgba(56, 189, 248, 0.25);
          color: #bae6fd;
        }
      `}</style>
    </div>
  );
}
