import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBookings } from "../services/bookings";
import { createConversation } from "../services/messaging";
import { createPlan, deletePlan, getPlans, updatePlan } from "../services/plans";
import { getServices } from "../services/services";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

type DraftPlanDay = {
  dayLabel: string;
  focus: string;
  details: string;
};

type DraftPlanWeek = {
  goal: string;
  days: DraftPlanDay[];
};

type StructuredPlanContent = {
  summary: string;
  weeks: Array<{
    week: number;
    goal: string;
    days: Array<{
      day: string;
      focus: string;
      details: string;
    }>;
  }>;
};

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

type PdfLine = { text: string; kind: "title" | "meta" | "section" | "body" | "spacer" | "summary" | "divider" };

function createStyledPlanPdfBlob(lines: PdfLine[]): Blob {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const headerHeight = 94;
  const startY = pageHeight - headerHeight - 22;
  const bottomY = 68;

  const pages: string[][] = [];
  let commands: string[] = [];
  let y = startY;

  const pushPage = () => {
    const headerCommands = [
      "q",
      "0.04 0.07 0.2 rg",
      `0 ${pageHeight - headerHeight} ${pageWidth} ${headerHeight} re`,
      "f",
      "Q",
      "BT",
      "/F2 18 Tf",
      "1 1 1 rg",
      `${marginX} ${pageHeight - 48} Td`,
      "(VaultFit Plan) Tj",
      "ET",
      "BT",
      "/F1 10 Tf",
      "0.62 0.71 1 rg",
      `${marginX} ${pageHeight - 68} Td`,
      "(Generated from trainer plan builder) Tj",
      "ET",
    ];
    pages.push([...headerCommands, ...commands]);
    commands = [];
    y = startY;
  };

  const lineHeightForKind = (kind: PdfLine["kind"]) => {
    if (kind === "title") return 18;
    if (kind === "section") return 18;
    if (kind === "meta") return 14;
    if (kind === "spacer") return 14;
    if (kind === "summary") return 13;
    return 14;
  };

  const styleForKind = (kind: PdfLine["kind"]) => {
    if (kind === "title") return { font: "F2", size: 15, color: "0.06 0.11 0.28" };
    if (kind === "section") return { font: "F2", size: 13, color: "0.12 0.2 0.47" };
    if (kind === "meta") return { font: "F1", size: 10, color: "0.3 0.35 0.45" };
    if (kind === "summary") return { font: "F1", size: 10, color: "0.1 0.12 0.2" };
    return { font: "F1", size: 10, color: "0.12 0.14 0.2" };
  };

  lines.forEach((line) => {
    if (line.kind === "spacer") {
      y -= lineHeightForKind("spacer");
      if (y < bottomY) pushPage();
      return;
    }
    if (line.kind === "divider") {
      if (y < bottomY + 20) pushPage();
      commands.push("q");
      commands.push("0.82 0.86 0.95 RG");
      commands.push("1.1 w");
      commands.push(`${marginX} ${y - 2} m`);
      commands.push(`${pageWidth - marginX} ${y - 2} l`);
      commands.push("S");
      commands.push("Q");
      y -= 12;
      return;
    }
    if (line.kind === "summary") {
      const summaryLines = wrapText(line.text, 74);
      const summaryLineHeight = lineHeightForKind("summary");
      const boxPadding = 8;
      const boxHeight = summaryLines.length * summaryLineHeight + boxPadding * 2;
      if (y - boxHeight < bottomY) pushPage();
      const boxTop = y;
      const boxBottom = y - boxHeight;
      commands.push("q");
      commands.push("0.93 0.95 1 rg");
      commands.push("0.7 0.78 1 RG");
      commands.push("0.8 w");
      commands.push(`${marginX} ${boxBottom} ${pageWidth - marginX * 2} ${boxHeight} re`);
      commands.push("B");
      commands.push("Q");
      let summaryY = boxTop - boxPadding - 11;
      summaryLines.forEach((wrappedLine) => {
        const style = styleForKind("summary");
        commands.push("BT");
        commands.push(`/${style.font} ${style.size} Tf`);
        commands.push(`${style.color} rg`);
        commands.push(`${marginX + 10} ${summaryY} Td`);
        commands.push(`(${escapePdfText(wrappedLine)}) Tj`);
        commands.push("ET");
        summaryY -= summaryLineHeight;
      });
      y -= boxHeight + 6;
      return;
    }

    const style = styleForKind(line.kind);
    const wrapAt = line.kind === "body" ? 86 : 78;
    const wrapped = wrapText(line.text, wrapAt);

    wrapped.forEach((wrappedLine) => {
      const lh = lineHeightForKind(line.kind);
      if (y < bottomY + lh) pushPage();
      commands.push("BT");
      commands.push(`/${style.font} ${style.size} Tf`);
      commands.push(`${style.color} rg`);
      commands.push(`${marginX} ${y} Td`);
      commands.push(`(${escapePdfText(wrappedLine)}) Tj`);
      commands.push("ET");
      y -= lh;
    });
  });

  pushPage();

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  let nextObjectId = 4;

  pages.forEach((pageCommands, index) => {
    const pageId = nextObjectId++;
    const contentId = nextObjectId++;
    pageObjectIds.push(pageId);
    const footerCommands = [
      "BT",
      "/F1 9 Tf",
      "0.34 0.37 0.45 rg",
      `${marginX} 28 Td`,
      "(Generated by VaultFit) Tj",
      "ET",
      "BT",
      "/F1 9 Tf",
      "0.34 0.37 0.45 rg",
      `${pageWidth - marginX - 64} 28 Td`,
      `(${escapePdfText(`Page ${index + 1} of ${pages.length}`)}) Tj`,
      "ET",
    ];
    const stream = [...pageCommands, ...footerCommands].join("\n");
    objects[pageId] =
      `<< /Type /Page /Parent 3 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 1 0 R /F2 2 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  objects[3] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;
  const catalogId = nextObjectId++;
  objects[catalogId] = "<< /Type /Catalog /Pages 3 0 R >>";

  const header = "%PDF-1.4\n";
  let body = "";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = header.length + body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefStart = header.length + body.length;
  const objectCount = objects.length;
  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (let id = 1; id < objectCount; id += 1) {
    const offset = offsets[id] ?? 0;
    xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objectCount} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const pdf = `${header}${body}${xref}${trailer}`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function PlansPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [planType, setPlanType] = useState<"fitness" | "nutrition" | "hybrid">("fitness");
  const [planSummary, setPlanSummary] = useState("");
  const [planWeeks, setPlanWeeks] = useState<DraftPlanWeek[]>([
    { goal: "", days: [{ dayLabel: "Day 1", focus: "", details: "" }] },
  ]);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
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
    enabled: user?.role === "client" || user?.role === "trainer",
  });

  const roleBookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);
  const clientOptions = useMemo(() => {
    const byClient = new Map<string, { latestDate: string; bookingId: string }>();
    roleBookings.forEach((booking) => {
      if (!booking.client_id) return;
      const existing = byClient.get(booking.client_id);
      if (!existing || booking.booking_date > existing.latestDate) {
        byClient.set(booking.client_id, { latestDate: booking.booking_date, bookingId: booking.id });
      }
    });
    return Array.from(byClient.entries())
      .map(([id, details]) => ({
        id,
        label: `Client ${id.slice(0, 8)} - latest booking ${details.latestDate}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [roleBookings]);
  const serviceTrainerIds = useMemo(
    () => Array.from(new Set(roleBookings.map((b) => b.trainer_id).filter((id): id is string => Boolean(id)))),
    [roleBookings],
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
    return roleBookings.filter((booking) => new Date(`${booking.booking_date}T00:00:00`) >= today);
  }, [roleBookings]);
  const pastBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return roleBookings.filter((booking) => new Date(`${booking.booking_date}T00:00:00`) < today);
  }, [roleBookings]);

  function formatTimeWindow(start: string, end: string): string {
    return `${start.slice(0, 5)}-${end.slice(0, 5)}`;
  }

  function counterpartLabel(booking: (typeof roleBookings)[number]): string {
    if (user?.role === "trainer") {
      return `Client ${booking.client_id?.slice(0, 8) ?? "Unknown"}`;
    }
    return booking.trainer_id ? (trainerNameById.get(booking.trainer_id) ?? "Trainer") : "Trainer";
  }

  function buildPlanContent(kind: "fitness" | "nutrition" | "hybrid", planTitle: string): StructuredPlanContent {
    return {
      summary: planSummary.trim() || `${kind} plan for ${planTitle}`,
      weeks: planWeeks.map((week, weekIdx) => ({
        week: weekIdx + 1,
        goal: week.goal.trim() || `Week ${weekIdx + 1} goal`,
        days: week.days.map((day, dayIdx) => ({
          day: day.dayLabel.trim() || `Day ${dayIdx + 1}`,
          focus: day.focus.trim() || "General training",
          details: day.details.trim() || "No specific notes",
        })),
      })),
    };
  }

  function addWeek() {
    setPlanWeeks((prev) => [...prev, { goal: "", days: [{ dayLabel: `Day 1`, focus: "", details: "" }] }]);
  }

  function removeWeek(weekIndex: number) {
    setPlanWeeks((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== weekIndex)));
  }

  function updateWeekGoal(weekIndex: number, goal: string) {
    setPlanWeeks((prev) =>
      prev.map((week, idx) => (idx === weekIndex ? { ...week, goal } : week)),
    );
  }

  function addDay(weekIndex: number) {
    setPlanWeeks((prev) =>
      prev.map((week, idx) =>
        idx === weekIndex
          ? {
              ...week,
              days: [...week.days, { dayLabel: `Day ${week.days.length + 1}`, focus: "", details: "" }],
            }
          : week,
      ),
    );
  }

  function removeDay(weekIndex: number, dayIndex: number) {
    setPlanWeeks((prev) =>
      prev.map((week, idx) => {
        if (idx !== weekIndex) return week;
        if (week.days.length <= 1) return week;
        return { ...week, days: week.days.filter((_, dIdx) => dIdx !== dayIndex) };
      }),
    );
  }

  function updateDayField(
    weekIndex: number,
    dayIndex: number,
    field: keyof DraftPlanDay,
    value: string,
  ) {
    setPlanWeeks((prev) =>
      prev.map((week, wIdx) => {
        if (wIdx !== weekIndex) return week;
        return {
          ...week,
          days: week.days.map((day, dIdx) =>
            dIdx === dayIndex ? { ...day, [field]: value } : day,
          ),
        };
      }),
    );
  }

  function parsePlanContent(content: unknown): StructuredPlanContent | null {
    if (!content || typeof content !== "object") return null;
    const maybe = content as Record<string, unknown>;
    if (!Array.isArray(maybe.weeks)) return null;

    const weeks = maybe.weeks
      .filter((week): week is Record<string, unknown> => Boolean(week) && typeof week === "object")
      .map((week, idx) => {
        const rawDays = Array.isArray(week.days) ? week.days : [];
        return {
          week: typeof week.week === "number" ? week.week : idx + 1,
          goal: typeof week.goal === "string" ? week.goal : `Week ${idx + 1}`,
          days: rawDays
            .filter((day): day is Record<string, unknown> => Boolean(day) && typeof day === "object")
            .map((day, dIdx) => ({
              day: typeof day.day === "string" ? day.day : `Day ${dIdx + 1}`,
              focus: typeof day.focus === "string" ? day.focus : "General",
              details: typeof day.details === "string" ? day.details : "",
            })),
        };
      });

    return {
      summary: typeof maybe.summary === "string" ? maybe.summary : "",
      weeks,
    };
  }

  function downloadPlanPdf(planTitle: string, planTypeValue: string, parsed: StructuredPlanContent | null) {
    const normalizedTitle = planTitle.trim() || "plan";
    const safeFilename = normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const lines: PdfLine[] = [
      { text: normalizedTitle, kind: "title" },
      { text: `Type: ${planTypeValue}`, kind: "meta" },
      { text: "", kind: "spacer" },
    ];

    if (!parsed) {
      lines.push({ text: "No structured content saved yet.", kind: "body" });
    } else {
      if (parsed.summary) {
        lines.push({ text: "Summary", kind: "section" });
        lines.push({ text: parsed.summary, kind: "summary" });
        lines.push({ text: "", kind: "spacer" });
      }
      parsed.weeks.forEach((week) => {
        lines.push({ text: `Week ${week.week}`, kind: "section" });
        lines.push({ text: `Goal: ${week.goal}`, kind: "body" });
        week.days.forEach((day) => {
          lines.push({ text: `${day.day} - ${day.focus}`, kind: "body" });
          if (day.details) lines.push({ text: day.details, kind: "meta" });
        });
        lines.push({ text: "", kind: "spacer" });
        lines.push({ text: "", kind: "divider" });
        lines.push({ text: "", kind: "spacer" });
      });
    }

    const pdfBlob = createStyledPlanPdfBlob(lines);
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${safeFilename || "plan"}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }

  function renderBookingItem(booking: (typeof roleBookings)[number]) {
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
                {booking.booking_date} | {formatTimeWindow(booking.start_time, booking.end_time)} |{" "}
                {user?.role === "trainer" ? "Client" : "Trainer"}: {counterpartLabel(booking)}
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
              <strong>{user?.role === "trainer" ? "Client" : "Trainer"}:</strong> {counterpartLabel(booking)}
            </p>
            <p className="muted booking-id-line">
              <strong>Booking Ref:</strong> {booking.id}
            </p>
            <div>
              <button
                className="secondary-btn"
                disabled={booking.status !== "confirmed" || openChatMutation.isPending}
                onClick={() => openChatMutation.mutate(booking.id)}
              >
                {openChatMutation.isPending ? "Opening chat..." : "Open booking chat"}
              </button>
              {booking.status !== "confirmed" ? (
                <p className="muted">Chat unlocks after payment and closes once service is completed.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </li>
    );
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      return createPlan(token, {
        clientId,
        title,
        planType,
        content: buildPlanContent(planType, title),
      });
    },
    onSuccess: () => {
      setError("");
      setTitle("");
      setPlanSummary("");
      setPlanWeeks([{ goal: "", days: [{ dayLabel: "Day 1", focus: "", details: "" }] }]);
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
  const openChatMutation = useMutation({
    mutationFn: (bookingId: string) => createConversation(token, bookingId),
    onSuccess: (conversation) => {
      setError("");
      const base = user?.role === "trainer" ? "/trainer/messages" : "/client/messages";
      navigate(`${base}?conversationId=${conversation.id}`);
    },
    onError: (e) => {
      const message = (e as Error).message;
      setError(message || "Unable to open booking chat right now.");
    },
  });

  return (
    <section>
      <h2>{user?.role === "client" ? "My plans" : "Plans"}</h2>

      {user?.role === "trainer" ? (
        <div className="card">
          <h3>Create Plan</h3>
          <p className="muted">Create structured plans for clients.</p>

          <label>Client</label>
          {clientOptions.length > 0 ? (
            <select onChange={(e) => setClientId(e.target.value)} value={clientId}>
              <option value="">Select client from your bookings</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="muted">No clients found yet. Confirm at least one booking first.</p>
          )}

          {clientOptions.length > 0 && clientId ? (
            <p className="muted">
              Selected client:{" "}
              {
                clientOptions.find((client) => client.id === clientId)?.label
              }
            </p>
          ) : null}

          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="4-week strength plan" />

          <label>Plan type</label>
          <select value={planType} onChange={(e) => setPlanType(e.target.value as "fitness" | "nutrition" | "hybrid")}>
            <option value="fitness">fitness</option>
            <option value="nutrition">nutrition</option>
            <option value="hybrid">hybrid</option>
          </select>

          <label>Plan summary</label>
          <input
            value={planSummary}
            onChange={(e) => setPlanSummary(e.target.value)}
            placeholder="What should the client achieve in this plan?"
          />

          <h4>Plan builder</h4>
          {planWeeks.map((week, weekIdx) => (
            <div key={`week-${weekIdx}`} className="card" style={{ marginBottom: "0.75rem" }}>
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <strong>Week {weekIdx + 1}</strong>
                <button className="secondary-btn" type="button" onClick={() => removeWeek(weekIdx)}>
                  Remove week
                </button>
              </div>

              <label>Week goal</label>
              <input
                value={week.goal}
                onChange={(e) => updateWeekGoal(weekIdx, e.target.value)}
                placeholder={`Week ${weekIdx + 1} goal`}
              />

              {week.days.map((day, dayIdx) => (
                <div key={`week-${weekIdx}-day-${dayIdx}`} className="card" style={{ marginTop: "0.5rem" }}>
                  <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Day {dayIdx + 1}</strong>
                    <button className="secondary-btn" type="button" onClick={() => removeDay(weekIdx, dayIdx)}>
                      Remove day
                    </button>
                  </div>
                  <label>Day label</label>
                  <input
                    value={day.dayLabel}
                    onChange={(e) => updateDayField(weekIdx, dayIdx, "dayLabel", e.target.value)}
                    placeholder={`Day ${dayIdx + 1}`}
                  />
                  <label>Focus</label>
                  <input
                    value={day.focus}
                    onChange={(e) => updateDayField(weekIdx, dayIdx, "focus", e.target.value)}
                    placeholder="Upper body, meal prep, recovery..."
                  />
                  <label>Details</label>
                  <textarea
                    rows={3}
                    value={day.details}
                    onChange={(e) => updateDayField(weekIdx, dayIdx, "details", e.target.value)}
                    placeholder="Workout/meal details, sets, reps, notes..."
                  />
                </div>
              ))}
              <button className="secondary-btn" type="button" onClick={() => addDay(weekIdx)}>
                Add day
              </button>
            </div>
          ))}
          <button className="secondary-btn" type="button" onClick={addWeek}>
            Add week
          </button>

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
              <div>
                <span>
                  <b>{plan.title}</b> ({plan.plan_type})
                </span>
                <p className="muted" style={{ marginTop: "0.35rem" }}>
                  {expandedPlanId === plan.id ? "Click to hide full plan" : "Click to view full plan"}
                </p>
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => setExpandedPlanId((prev) => (prev === plan.id ? null : plan.id))}
                >
                  {expandedPlanId === plan.id ? "Hide plan details" : "View plan details"}
                </button>
                {expandedPlanId === plan.id
                  ? (() => {
                      const parsed = parsePlanContent(plan.content);
                      if (!parsed) {
                        return (
                          <>
                            <p className="muted">No structured content saved yet.</p>
                            <button
                              className="secondary-btn"
                              type="button"
                              onClick={() => downloadPlanPdf(plan.title, plan.plan_type, parsed)}
                            >
                              Download PDF
                            </button>
                          </>
                        );
                      }
                      return (
                        <div className="muted" style={{ marginTop: "0.35rem" }}>
                          {parsed.summary ? (
                            <p>
                              <strong>Summary:</strong> {parsed.summary}
                            </p>
                          ) : null}
                          {parsed.weeks.map((week) => (
                            <div key={`plan-${plan.id}-week-${week.week}`} style={{ marginBottom: "0.35rem" }}>
                              <p>
                                <strong>Week {week.week}:</strong> {week.goal}
                              </p>
                              {week.days.map((day, idx) => (
                                <p key={`plan-${plan.id}-week-${week.week}-day-${idx}`}>
                                  - <strong>{day.day}:</strong> {day.focus} {day.details ? `- ${day.details}` : ""}
                                </p>
                              ))}
                            </div>
                          ))}
                          <button
                            className="secondary-btn"
                            type="button"
                            onClick={() => downloadPlanPdf(plan.title, plan.plan_type, parsed)}
                          >
                            Download PDF
                          </button>
                        </div>
                      );
                    })()
                  : null}
              </div>
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

      {user?.role === "client" || user?.role === "trainer" ? (
        <div className="card">
          <h3>{user?.role === "trainer" ? "Client service chats" : "Booked services"}</h3>
          {error ? <p className="error">{error}</p> : null}
          {bookingsQuery.isLoading ? <p>Loading booked services...</p> : null}
          {!bookingsQuery.isLoading && roleBookings.length === 0 ? (
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
