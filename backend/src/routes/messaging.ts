import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { ensureVerifiedTrainerUser } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import { tagRouteModule } from "../middleware/route-module.js";

const createConversationSchema = z.object({
  bookingId: z.uuid(),
});

const sendMessageSchema = z.object({
  message: z.string().min(1).max(4000),
});

export const messagingRouter = Router();
messagingRouter.use(tagRouteModule("messaging"));
let chatMediaBucketEnsured = false;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

messagingRouter.get("/conversations", requireAuth, async (req, res) => {
  if (req.user!.role === "trainer" || req.user!.role === "nutritionist") await ensureVerifiedTrainerUser(req.user!.id);
  const userId = req.user!.id;
  const trainerId = await getTrainerIdForUser(userId);
  const includeClosed = String(req.query.includeClosed ?? "false") === "true";

  let query = supabaseAdmin
    .from("conversations")
    .select("*, client_profile:client_id(full_name)")
    .order("created_at", { ascending: false });
  query = trainerId ? query.or(`client_id.eq.${userId},trainer_id.eq.${trainerId}`) : query.eq("client_id", userId);

  const { data, error } = await query;
  if (error) throw new HttpError(400, error.message, "CONVERSATIONS_LIST_FAILED");

  const conversationsWithState = [];
  for (const conversation of data ?? []) {
    const allowed = conversation.booking_id
      ? await isBookingChatOpen(conversation.booking_id)
      : await hasActivePaidSession(conversation.client_id, conversation.trainer_id);
    if (allowed || includeClosed) {
      conversationsWithState.push({
        ...conversation,
        chat_open: allowed,
      });
    }
  }
  res.json(conversationsWithState);
});

messagingRouter.post("/conversations", requireAuth, async (req, res) => {
  const payload = createConversationSchema.parse(req.body);
  if (req.user!.role !== "client" && req.user!.role !== "trainer" && req.user!.role !== "nutritionist") {
    throw new HttpError(403, "Only clients and trainers can use chat", "FORBIDDEN");
  }
  const booking = await getBookingForConversation(payload.bookingId, req.user!.id, req.user!.role);
  await ensureBookingChatOpen(booking.id);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("booking_id", booking.id)
    .maybeSingle();
  if (existingError) {
    if (existingError.message?.includes("booking_id") || existingError.message?.includes("service_id")) {
      throw new HttpError(
        500,
        "Database schema is outdated for booking chat. Apply backend/supabase/migrations/20260425222000_conversations_booking_link.sql",
        "SCHEMA_OUTDATED",
      );
    }
    throw new HttpError(400, existingError.message, "CONVERSATION_CREATE_FAILED");
  }
  if (existing) {
    res.status(200).json(existing);
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      client_id: booking.client_id,
      trainer_id: booking.trainer_id,
      booking_id: booking.id,
      service_id: booking.service_id,
    })
    .select("*")
    .single();

  if (error) {
    if (error.message?.includes("booking_id") || error.message?.includes("service_id")) {
      throw new HttpError(
        500,
        "Database schema is outdated for booking chat. Apply backend/supabase/migrations/20260425222000_conversations_booking_link.sql",
        "SCHEMA_OUTDATED",
      );
    }
    throw new HttpError(400, error.message, "CONVERSATION_CREATE_FAILED");
  }

  const recipientProfileId = booking.client_id === req.user!.id ? booking.trainer_id : booking.client_id;
  await createNotification(recipientProfileId, "New conversation", "A conversation opened for your booked service.");
  res.status(201).json(data);
});

messagingRouter.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  if (req.user!.role === "trainer" || req.user!.role === "nutritionist") await ensureVerifiedTrainerUser(req.user!.id);
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
  const hydrated = await Promise.all((data ?? []).map((row) => hydrateMessageImageUrl(row, req.user!.id)));
  res.json(hydrated);
});

messagingRouter.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  if (req.user!.role === "trainer" || req.user!.role === "nutritionist") await ensureVerifiedTrainerUser(req.user!.id);
  const payload = sendMessageSchema.parse(req.body);
  const conversationId = String(req.params.id);
  const conversation = await getConversationForUser(conversationId, req.user!.id);
  await ensureConversationMessagingOpen(conversation);

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_id: req.user!.id,
      message: payload.message,
      message_type: "text",
      image_url: null,
      is_read: false,
    })
    .select("*")
    .single();

  if (error) throw new HttpError(400, error.message, "MESSAGE_SEND_FAILED");

  const recipientId = conversation.client_id === req.user!.id ? conversation.trainer_id : conversation.client_id;
  await createNotification(recipientId, "New message", "You received a new message.");

  res.status(201).json(data);
});

messagingRouter.post(
  "/conversations/:id/messages/image",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    if (req.user!.role === "trainer" || req.user!.role === "nutritionist") await ensureVerifiedTrainerUser(req.user!.id);
    const conversationId = String(req.params.id);
    const conversation = await getConversationForUser(conversationId, req.user!.id);
    await ensureConversationMessagingOpen(conversation);
    const imageFile = req.file;
    if (!imageFile) {
      throw new HttpError(400, "Image file is required.", "MESSAGE_IMAGE_REQUIRED");
    }
    const allowedMime = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMime.includes(imageFile.mimetype)) {
      throw new HttpError(400, "Only JPG, PNG or WEBP images are allowed.", "MESSAGE_IMAGE_INVALID_TYPE");
    }

    const extension = imageFile.mimetype === "image/png" ? "png" : imageFile.mimetype === "image/webp" ? "webp" : "jpg";
    const objectPath = `${conversation.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    await ensureChatMediaBucketExists();
    const { error: uploadError } = await supabaseAdmin.storage.from(env.chatMediaBucket).upload(objectPath, imageFile.buffer, {
      contentType: imageFile.mimetype,
      upsert: false,
    });
    if (uploadError) {
      throw new HttpError(400, uploadError.message, "MESSAGE_IMAGE_UPLOAD_FAILED");
    }

    const imageRef = `storage://${env.chatMediaBucket}/${objectPath}`;
    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: req.user!.id,
        message: "[Image]",
        message_type: "image",
        image_url: imageRef,
        is_read: false,
      })
      .select("*")
      .single();
    if (error) throw new HttpError(400, error.message, "MESSAGE_SEND_FAILED");

    const recipientId = conversation.client_id === req.user!.id ? conversation.trainer_id : conversation.client_id;
    await createNotification(recipientId, "New image", "You received an image message.");
    res.status(201).json(await hydrateMessageImageUrl(data, req.user!.id));
  },
);

messagingRouter.patch("/conversations/:id/messages/read", requireAuth, async (req, res) => {
  if (req.user!.role === "trainer" || req.user!.role === "nutritionist") await ensureVerifiedTrainerUser(req.user!.id);
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

async function ensureConversationMessagingOpen(conversation: {
  booking_id?: string | null;
  client_id: string;
  trainer_id: string;
}): Promise<void> {
  if (conversation.booking_id) {
    await ensureBookingChatOpen(conversation.booking_id);
    return;
  }
  const allowed = await hasActivePaidSession(conversation.client_id, conversation.trainer_id);
  if (!allowed) {
    throw new HttpError(409, "Chat is closed for this conversation.", "CHAT_CLOSED");
  }
}

async function getBookingForConversation(
  bookingId: string,
  userId: string,
  role: string | undefined,
): Promise<{ id: string; client_id: string; trainer_id: string; service_id: string | null; status: string }> {
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id, client_id, trainer_id, service_id, status")
    .eq("id", bookingId)
    .single();
  if (error || !booking) throw new HttpError(404, "Booking not found", "BOOKING_NOT_FOUND");

  if (role === "client") {
    if (booking.client_id !== userId) throw new HttpError(403, "Only booking owner can start chat", "FORBIDDEN");
    return booking;
  }
  if (role === "trainer" || role === "nutritionist") {
    await ensureVerifiedTrainerUser(userId);
    const trainerId = await getTrainerIdForUser(userId);
    if (!trainerId || trainerId !== booking.trainer_id) {
      throw new HttpError(403, "Only assigned trainer can open this chat", "FORBIDDEN");
    }
    return booking;
  }
  throw new HttpError(403, "Forbidden", "FORBIDDEN");
}

async function ensureBookingChatOpen(bookingId: string): Promise<void> {
  const open = await isBookingChatOpen(bookingId);
  if (!open) {
    throw new HttpError(409, "Chat opens only for paid, confirmed bookings", "CHAT_NOT_AVAILABLE");
  }
}

async function isBookingChatOpen(bookingId: string): Promise<boolean> {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .single();
  if (bookingError || !booking) return false;
  if (booking.status !== "confirmed") return false;

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .eq("booking_id", bookingId)
    .eq("status", "paid")
    .maybeSingle();
  if (paymentError) throw new HttpError(400, paymentError.message, "CHAT_ELIGIBILITY_CHECK_FAILED");
  return Boolean(payment);
}

async function hasActivePaidSession(clientId: string, trainerId: string): Promise<boolean> {
  const { data: bookings, error: bookingsError } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("client_id", clientId)
    .eq("trainer_id", trainerId)
    .eq("status", "confirmed");
  if (bookingsError) throw new HttpError(400, bookingsError.message, "CHAT_ELIGIBILITY_CHECK_FAILED");

  const bookingIds = (bookings ?? []).map((booking) => booking.id);
  if (bookingIds.length === 0) return false;

  const { data: paidRows, error: paidError } = await supabaseAdmin
    .from("payments")
    .select("booking_id")
    .in("booking_id", bookingIds)
    .eq("status", "paid");
  if (paidError) throw new HttpError(400, paidError.message, "CHAT_ELIGIBILITY_CHECK_FAILED");

  return (paidRows ?? []).length > 0;
}

function parseStorageRef(value: string): { bucket: string; objectPath: string } | null {
  if (!value.startsWith("storage://")) return null;
  const withoutPrefix = value.slice("storage://".length);
  const slashIdx = withoutPrefix.indexOf("/");
  if (slashIdx <= 0) return null;
  return {
    bucket: withoutPrefix.slice(0, slashIdx),
    objectPath: withoutPrefix.slice(slashIdx + 1),
  };
}

async function hydrateMessageImageUrl(row: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  const imageRef = typeof row.image_url === "string" ? row.image_url : null;
  if (!imageRef) return row;
  if (imageRef.startsWith("http://") || imageRef.startsWith("https://")) {
    return { ...row, image_signed_url: imageRef };
  }
  const parsed = parseStorageRef(imageRef);
  if (!parsed) return row;
  const { data, error } = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.objectPath, 60 * 60);
  if (error || !data?.signedUrl) {
    console.error("Failed to sign chat image URL for user", userId, error?.message);
    return row;
  }
  return { ...row, image_signed_url: data.signedUrl };
}

async function ensureChatMediaBucketExists(): Promise<void> {
  if (chatMediaBucketEnsured) return;
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    throw new HttpError(500, error.message, "CHAT_BUCKET_LOOKUP_FAILED");
  }
  const existing = (buckets ?? []).some((bucket) => bucket.name === env.chatMediaBucket || bucket.id === env.chatMediaBucket);
  if (!existing) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(env.chatMediaBucket, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (createError) {
      throw new HttpError(500, createError.message, "CHAT_BUCKET_CREATE_FAILED");
    }
  }
  chatMediaBucketEnsured = true;
}
