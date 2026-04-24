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
  bio: string | null;
  specialty: string | null;
  hourly_rate: number;
  verified: boolean;
  profiles?: { full_name?: string; avatar_url?: string };
}

export interface Booking {
  id: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  booking_date: string;
  start_time: string;
  end_time: string;
  trainer_id?: string;
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
