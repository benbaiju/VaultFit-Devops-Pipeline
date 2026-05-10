import { Router } from "express";
import { z } from "zod";
import { recordAdminAudit } from "../lib/admin-audit.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(180),
  description: z.string().trim().min(5).max(6000),
  category: z.enum(["booking", "payment", "verification", "account", "technical", "other"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});

const addCommentSchema = z.object({
  comment: z.string().trim().min(1).max(4000),
});

const adminUpdateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "waiting_user", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedAdminUserId: z.string().uuid().nullable().optional(),
  resolutionNote: z.string().trim().max(6000).nullable().optional(),
});

const listAdminTicketsSchema = z.object({
  status: z.enum(["open", "in_progress", "waiting_user", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedAdminUserId: z.string().uuid().optional(),
  createdByUserId: z.string().uuid().optional(),
});

export const ticketsRouter = Router();

ticketsRouter.post("/tickets", requireAuth, async (req, res) => {
  const payload = createTicketSchema.parse(req.body);
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      created_by_user_id: req.user!.id,
      category: payload.category ?? "other",
      priority: payload.priority ?? "normal",
      status: "open",
      subject: payload.subject,
      description: payload.description,
    })
    .select("*")
    .single();
  if (error || !data) throw new HttpError(400, error?.message ?? "Failed to create ticket", "TICKET_CREATE_FAILED");

  await insertTicketEvent(data.id, req.user!.id, "created", {
    category: data.category,
    priority: data.priority,
    subject: data.subject,
  });
  await notifyAllAdmins("New support ticket", `Ticket "${data.subject}" was created.`);

  res.status(201).json(data);
});

ticketsRouter.get("/tickets", requireAuth, async (req, res) => {
  const isAdmin = req.user?.role === "admin";
  let query = supabaseAdmin
    .from("support_tickets")
    .select("*, created_by:created_by_user_id(full_name, email, role), assigned_admin:assigned_admin_user_id(full_name, email)")
    .order("created_at", { ascending: false });
  if (!isAdmin) {
    query = query.eq("created_by_user_id", req.user!.id);
  }
  const { data, error } = await query;
  if (error) throw new HttpError(400, error.message, "TICKETS_LIST_FAILED");
  res.json(data ?? []);
});

ticketsRouter.get("/tickets/:id", requireAuth, async (req, res) => {
  const ticket = await getTicketForUser(req.params.id, req.user!.id, req.user?.role === "admin");
  res.json(ticket);
});

ticketsRouter.get("/tickets/:id/timeline", requireAuth, async (req, res) => {
  const ticket = await getTicketForUser(req.params.id, req.user!.id, req.user?.role === "admin");
  const { data, error } = await supabaseAdmin
    .from("support_ticket_events")
    .select("*, actor:actor_user_id(full_name, email)")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });
  if (error) throw new HttpError(400, error.message, "TICKET_TIMELINE_FAILED");
  res.json(data ?? []);
});

ticketsRouter.post("/tickets/:id/comments", requireAuth, async (req, res) => {
  const payload = addCommentSchema.parse(req.body);
  const ticket = await getTicketForUser(req.params.id, req.user!.id, req.user?.role === "admin");
  await insertTicketEvent(ticket.id, req.user!.id, "comment", { comment: payload.comment });
  if (req.user?.role === "admin") {
    await createNotification(ticket.created_by_user_id, "Support ticket update", `Admin replied: ${ticket.subject}`);
    void recordAdminAudit({
      actorUserId: req.user!.id,
      action: "support_ticket_commented",
      targetType: "ticket",
      targetId: ticket.id,
      detail: { comment: payload.comment.slice(0, 180) },
    });
  }
  res.status(201).json({ message: "Comment added" });
});

ticketsRouter.get("/admin/tickets", requireAuth, requireRole(["admin"]), async (req, res) => {
  const filters = listAdminTicketsSchema.parse(req.query);
  let query = supabaseAdmin
    .from("support_tickets")
    .select("*, created_by:created_by_user_id(full_name, email, role), assigned_admin:assigned_admin_user_id(full_name, email)")
    .order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.assignedAdminUserId) query = query.eq("assigned_admin_user_id", filters.assignedAdminUserId);
  if (filters.createdByUserId) query = query.eq("created_by_user_id", filters.createdByUserId);

  const { data, error } = await query;
  if (error) throw new HttpError(400, error.message, "ADMIN_TICKETS_LIST_FAILED");
  res.json(data ?? []);
});

ticketsRouter.patch("/admin/tickets/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  const payload = adminUpdateTicketSchema.parse(req.body);
  const { data: existing, error: existingError } = await supabaseAdmin.from("support_tickets").select("*").eq("id", req.params.id).single();
  if (existingError || !existing) throw new HttpError(404, "Ticket not found", "TICKET_NOT_FOUND");

  if (payload.status && !isValidStatusTransition(existing.status, payload.status)) {
    throw new HttpError(409, `Invalid ticket status transition: ${existing.status} -> ${payload.status}`, "INVALID_STATUS_TRANSITION");
  }

  const nextStatus = payload.status ?? existing.status;
  const nextResolutionNote =
    payload.resolutionNote === undefined
      ? existing.resolution_note
      : payload.resolutionNote;

  const patch: Record<string, unknown> = {
    ...(payload.status ? { status: payload.status } : {}),
    ...(payload.priority ? { priority: payload.priority } : {}),
    ...(payload.assignedAdminUserId !== undefined ? { assigned_admin_user_id: payload.assignedAdminUserId } : {}),
    ...(payload.resolutionNote !== undefined ? { resolution_note: payload.resolutionNote } : {}),
  };
  if (nextStatus === "resolved" && existing.status !== "resolved") patch.resolved_at = new Date().toISOString();
  if (nextStatus === "closed" && existing.status !== "closed") patch.closed_at = new Date().toISOString();
  if (nextStatus === "open") {
    patch.resolved_at = null;
    patch.closed_at = null;
  }

  const { data, error } = await supabaseAdmin.from("support_tickets").update(patch).eq("id", req.params.id).select("*").single();
  if (error || !data) throw new HttpError(400, error?.message ?? "Failed to update ticket", "TICKET_UPDATE_FAILED");

  if (payload.status && payload.status !== existing.status) {
    await insertTicketEvent(data.id, req.user!.id, payload.status === "open" ? "reopened" : "status_changed", {
      from: existing.status,
      to: payload.status,
    });
  }
  if (payload.priority && payload.priority !== existing.priority) {
    await insertTicketEvent(data.id, req.user!.id, "priority_changed", { from: existing.priority, to: payload.priority });
  }
  if (payload.assignedAdminUserId !== undefined && payload.assignedAdminUserId !== existing.assigned_admin_user_id) {
    await insertTicketEvent(data.id, req.user!.id, "assigned", {
      from: existing.assigned_admin_user_id,
      to: payload.assignedAdminUserId,
    });
  }
  if (payload.status === "closed") {
    await insertTicketEvent(data.id, req.user!.id, "closed", {
      resolution_note: data.resolution_note,
    });
  }

  await createNotification(data.created_by_user_id, "Support ticket updated", `Ticket "${data.subject}" is now ${data.status}.`);
  void recordAdminAudit({
    actorUserId: req.user!.id,
    action: "support_ticket_updated",
    targetType: "ticket",
    targetId: data.id,
    detail: {
      status: data.status,
      priority: data.priority,
      assigned_admin_user_id: data.assigned_admin_user_id,
    },
  });
  res.json(data);
});

ticketsRouter.get("/admin/tickets/:id/timeline", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("support_ticket_events")
    .select("*, actor:actor_user_id(full_name, email)")
    .eq("ticket_id", req.params.id)
    .order("created_at", { ascending: true });
  if (error) throw new HttpError(400, error.message, "TICKET_TIMELINE_FAILED");
  res.json(data ?? []);
});

async function getTicketForUser(ticketId: string, userId: string, isAdmin: boolean | undefined) {
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select("*, created_by:created_by_user_id(full_name, email, role), assigned_admin:assigned_admin_user_id(full_name, email)")
    .eq("id", ticketId)
    .single();
  if (error || !data) throw new HttpError(404, "Ticket not found", "TICKET_NOT_FOUND");
  if (!isAdmin && data.created_by_user_id !== userId) throw new HttpError(403, "Forbidden", "FORBIDDEN");
  return data;
}

async function insertTicketEvent(
  ticketId: string,
  actorUserId: string,
  eventType: "created" | "status_changed" | "assigned" | "comment" | "priority_changed" | "closed" | "reopened",
  detail: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin.from("support_ticket_events").insert({
    ticket_id: ticketId,
    actor_user_id: actorUserId,
    event_type: eventType,
    detail,
  });
  if (error) {
    throw new HttpError(400, error.message, "TICKET_EVENT_CREATE_FAILED");
  }
}

async function notifyAllAdmins(title: string, body: string): Promise<void> {
  const { data: admins, error } = await supabaseAdmin.from("profiles").select("id").eq("role", "admin");
  if (error) return;
  for (const admin of admins ?? []) {
    await createNotification(admin.id, title, body);
  }
}

async function createNotification(userId: string, title: string, body: string): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title,
    body,
    is_read: false,
  });
  if (error) {
    console.error("Failed to create support notification", error.message);
  }
}

function isValidStatusTransition(from: string, to: string): boolean {
  const map: Record<string, string[]> = {
    open: ["in_progress", "waiting_user", "resolved", "closed"],
    in_progress: ["waiting_user", "resolved", "closed"],
    waiting_user: ["in_progress", "resolved", "closed"],
    resolved: ["closed", "open"],
    closed: ["open"],
  };
  if (from === to) return true;
  return (map[from] ?? []).includes(to);
}
