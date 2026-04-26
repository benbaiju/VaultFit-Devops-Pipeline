import { apiRequest } from "../lib/api-client";
import type { Conversation, Message, Notification } from "../types/api";

export async function getConversations(token: string, includeClosed = false): Promise<Conversation[]> {
  const params = new URLSearchParams();
  if (includeClosed) params.set("includeClosed", "true");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<Conversation[]>(`/conversations${suffix}`, {}, token);
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

export async function getNotifications(token: string): Promise<Notification[]> {
  return apiRequest<Notification[]>("/notifications", {}, token);
}

export async function markNotificationRead(token: string, notificationId: string): Promise<void> {
  await apiRequest(`/notifications/${notificationId}/read`, { method: "PATCH" }, token);
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await apiRequest("/notifications/read-all", { method: "PATCH" }, token);
}
