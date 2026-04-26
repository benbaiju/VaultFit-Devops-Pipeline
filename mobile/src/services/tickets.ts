import { apiRequest } from "../lib/api-client";
import type { SupportTicket, SupportTicketEvent, TicketCategory, TicketPriority, TicketStatus } from "../types/api";

type ListAdminTicketsFilters = {
  status?: TicketStatus;
  priority?: TicketPriority;
};

export async function createTicket(
  token: string,
  input: { subject: string; description: string; category?: TicketCategory; priority?: TicketPriority },
): Promise<SupportTicket> {
  return apiRequest<SupportTicket>(
    "/tickets",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function getMyTickets(token: string): Promise<SupportTicket[]> {
  return apiRequest<SupportTicket[]>("/tickets", {}, token);
}

export async function getTicketTimeline(token: string, ticketId: string): Promise<SupportTicketEvent[]> {
  return apiRequest<SupportTicketEvent[]>(`/tickets/${ticketId}/timeline`, {}, token);
}

export async function getAdminTickets(token: string, filters?: ListAdminTicketsFilters): Promise<SupportTicket[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.priority) params.set("priority", filters.priority);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<SupportTicket[]>(`/admin/tickets${suffix}`, {}, token);
}

export async function updateAdminTicket(
  token: string,
  ticketId: string,
  input: { status?: TicketStatus; priority?: TicketPriority; assignedAdminUserId?: string | null; resolutionNote?: string | null },
): Promise<SupportTicket> {
  return apiRequest<SupportTicket>(
    `/admin/tickets/${ticketId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function getAdminTicketTimeline(token: string, ticketId: string): Promise<SupportTicketEvent[]> {
  return apiRequest<SupportTicketEvent[]>(`/admin/tickets/${ticketId}/timeline`, {}, token);
}

export async function addTicketComment(token: string, ticketId: string, comment: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    `/tickets/${ticketId}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ comment }),
    },
    token,
  );
}
