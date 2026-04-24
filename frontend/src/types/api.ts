export type Role = "client" | "trainer" | "admin";

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

export interface Trainer {
  id: string;
  user_id?: string;
  bio: string | null;
  specialty: string | null;
  hourly_rate: number;
  verified: boolean;
  profiles?: { full_name?: string; avatar_url?: string };
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
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
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
