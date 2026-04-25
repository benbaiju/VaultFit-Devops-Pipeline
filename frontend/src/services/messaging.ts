import { apiRequest } from "../lib/api-client";
import type { Conversation, Message, Notification } from "../types/api";

export async function getConversations(token: string): Promise<Conversation[]> {
  return apiRequest<Conversation[]>("/conversations", {}, token);
}

export async function createConversation(token: string, bookingId: string): Promise<Conversation> {
  return apiRequest<Conversation>(
    "/conversations",
    {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    },
    token,
  );
}

export async function getMessages(token: string, conversationId: string): Promise<Message[]> {
  return apiRequest<Message[]>(`/conversations/${conversationId}/messages?limit=50&offset=0`, {}, token);
}

export async function sendMessage(token: string, conversationId: string, message: string): Promise<Message> {
  return apiRequest<Message>(
    `/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    },
    token,
  );
}

export async function markConversationRead(token: string, conversationId: string): Promise<void> {
  await apiRequest(`/conversations/${conversationId}/messages/read`, { method: "PATCH" }, token);
}

export async function getNotifications(token: string): Promise<Notification[]> {
  return apiRequest<Notification[]>("/notifications", {}, token);
}

export async function markNotificationRead(token: string, notificationId: string): Promise<void> {
  await apiRequest(`/notifications/${notificationId}/read`, { method: "PATCH" }, token);
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await apiRequest("/notifications/read-all", { method: "PATCH" }, token);
}
