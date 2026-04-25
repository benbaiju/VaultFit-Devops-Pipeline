export type Role = "client" | "trainer" | "nutritionist" | "admin";

export interface User {
  id: string;
  email: string;
  role: Role;
  full_name?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  phone_verified?: boolean;
  phone_verified_at?: string | null;
  avatar_url: string | null;
  timezone: string | null;
  role: Role;
  created_at?: string;
}

export interface Trainer {
  id: string;
  user_id?: string;
  bio: string | null;
  specialty: string | null;
  experience_years?: number;
  hourly_rate: number;
  verified: boolean;
  profiles?: { full_name?: string; avatar_url?: string; email?: string };
}

export interface Service {
  id: string;
  trainer_id: string;
  title: string;
  service_type: "session" | "program" | "consultation";
  duration_minutes: number;
  price: number;
  is_active: boolean;
  created_at?: string;
}

export interface Booking {
  id: string;
  client_id?: string;
  service_id?: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  booking_date: string;
  start_time: string;
  end_time: string;
  trainer_id?: string;
}

export interface OpenSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export interface AvailabilitySlot {
  id: string;
  trainer_id: string;
  service_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface BlockedDate {
  id: string;
  trainer_id: string;
  service_id?: string | null;
  blocked_date: string;
  reason: string | null;
}

export interface Review {
  id: string;
  booking_id: string;
  client_id: string;
  trainer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  client_id: string;
  trainer_id: string;
  title: string;
  plan_type: "fitness" | "nutrition" | "hybrid";
  content: unknown;
  created_at: string;
}

export interface Conversation {
  id: string;
  client_id: string;
  trainer_id: string;
  booking_id?: string | null;
  service_id?: string | null;
  chat_open?: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  message_type?: "text" | "image";
  image_url?: string | null;
  image_signed_url?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface VerificationRequest {
  id: string;
  trainer_id: string;
  status: "pending" | "approved" | "rejected";
  credential_url: string;
  identity_url: string | null;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
  /** When true, API login and all authenticated API calls are rejected for this user. */
  access_suspended?: boolean;
}

export interface AdminTrainer {
  id: string;
  user_id: string;
  verified: boolean;
  specialty: string | null;
  hourly_rate: number;
  bio: string | null;
  created_at?: string;
  profiles?: { email?: string; full_name?: string | null; role?: Role } | null;
}

export interface AdminReviewTimelineItem {
  source: "audit" | "legacy_verification";
  id: string;
  at: string;
  action: string;
  target_type: string;
  target_id: string;
  detail: Record<string, unknown>;
  actor?: { id?: string; email?: string; full_name?: string | null };
}

export interface AdminReviewTimelineResponse {
  items: AdminReviewTimelineItem[];
  warning?: string;
}
