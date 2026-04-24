import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";

const createConversationSchema = z.object({
  trainerId: z.uuid(),
});

const sendMessageSchema = z.object({
  message: z.string().min(1).max(4000),
});

export const messagingRouter = Router();

messagingRouter.get("/conversations", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const trainerId = await getTrainerIdForUser(userId);

  let query = supabaseAdmin.from("conversations").select("*").order("created_at", { ascending: false });
  query = trainerId ? query.or(`client_id.eq.${userId},trainer_id.eq.${trainerId}`) : query.eq("client_id", userId);

  const { data, error } = await query;
  if (error) throw new HttpError(400, error.message, "CONVERSATIONS_LIST_FAILED");
  res.json(data);
});

messagingRouter.post("/conversations", requireAuth, async (req, res) => {
  const payload = createConversationSchema.parse(req.body);
  const clientId = req.user!.id;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("client_id", clientId)
    .eq("trainer_id", payload.trainerId)
    .maybeSingle();
  if (existingError) throw new HttpError(400, existingError.message, "CONVERSATION_CREATE_FAILED");
  if (existing) {
    res.status(200).json(existing);
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({ client_id: clientId, trainer_id: payload.trainerId })
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "CONVERSATION_CREATE_FAILED");

  await createNotification(payload.trainerId, "New conversation", "A client started a conversation with you.");
  res.status(201).json(data);
});

messagingRouter.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const conversationId = String(req.params.id);
  const conversation = await getConversationForUser(conversationId, req.user!.id);

  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .range(offset, offset + Math.max(1, Math.min(100, limit)) - 1);

  if (error) throw new HttpError(400, error.message, "MESSAGES_LIST_FAILED");
  res.json(data);
});

messagingRouter.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  const payload = sendMessageSchema.parse(req.body);
  const conversationId = String(req.params.id);
  const conversation = await getConversationForUser(conversationId, req.user!.id);

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_id: req.user!.id,
      message: payload.message,
      is_read: false,
    })
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "MESSAGE_SEND_FAILED");

  const recipientId = conversation.client_id === req.user!.id ? conversation.trainer_id : conversation.client_id;
  await createNotification(recipientId, "New message", "You received a new message.");

  res.status(201).json(data);
});

messagingRouter.patch("/conversations/:id/messages/read", requireAuth, async (req, res) => {
  const conversationId = String(req.params.id);
  const conversation = await getConversationForUser(conversationId, req.user!.id);

  const { error } = await supabaseAdmin
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversation.id)
    .neq("sender_id", req.user!.id);

  if (error) throw new HttpError(400, error.message, "MESSAGES_MARK_READ_FAILED");
  res.json({ message: "Conversation messages marked as read" });
});

messagingRouter.get("/notifications", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", req.user!.id)
    .order("is_read", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new HttpError(400, error.message, "NOTIFICATIONS_LIST_FAILED");
  res.json(data);
});

messagingRouter.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", req.params.id)
    .eq("user_id", req.user!.id)
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "NOTIFICATION_MARK_READ_FAILED");
  res.json(data);
});

messagingRouter.patch("/notifications/read-all", requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin.from("notifications").update({ is_read: true }).eq("user_id", req.user!.id);
  if (error) throw new HttpError(400, error.message, "NOTIFICATIONS_MARK_ALL_READ_FAILED");
  res.json({ message: "All notifications marked as read" });
});

async function getTrainerIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from("trainers").select("id").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return data.id;
}

async function getConversationForUser(conversationId: string, userId: string) {
  const { data: conversation, error } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (error || !conversation) throw new HttpError(404, "Conversation not found", "CONVERSATION_NOT_FOUND");

  const trainerId = await getTrainerIdForUser(userId);
  const isParticipant = conversation.client_id === userId || (trainerId !== null && conversation.trainer_id === trainerId);
  if (!isParticipant) throw new HttpError(403, "Forbidden", "FORBIDDEN");

  return conversation;
}

async function createNotification(userId: string, title: string, body: string): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title,
    body,
    is_read: false,
  });
  if (error) {
    console.error("Failed to create notification", error.message);
  }
}
