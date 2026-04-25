import type { Role } from "../types/api";

export const ROUTES = {
  login: "/login",
  register: "/register",
  client: {
    root: "/client",
    book: "/client/book",
    plans: "/client/plans",
    reviews: "/client/reviews",
    messages: "/client/messages",
    notifications: "/client/notifications",
  },
  trainer: {
    root: "/trainer",
    services: "/trainer/services",
    bookings: "/trainer/bookings",
    plans: "/trainer/plans",
    messages: "/trainer/messages",
    notifications: "/trainer/notifications",
    verification: "/trainer/verification",
  },
  admin: {
    root: "/admin",
  },
} as const;

export function defaultHomeForRole(role: Role | undefined): string {
  switch (role) {
    case "admin":
      return ROUTES.admin.root;
    case "trainer":
      return ROUTES.trainer.root;
    case "client":
      return ROUTES.client.root;
    default:
      return ROUTES.login;
  }
}

export function postLoginPath(role: Role | undefined, from?: string | null): string {
  const home = defaultHomeForRole(role);
  if (!from || from === "/" || from === ROUTES.login) return home;
  if (role === "client" && from.startsWith("/client")) return from;
  if (role === "trainer" && from.startsWith("/trainer")) return from;
  if (role === "admin" && from.startsWith("/admin")) return from;
  return home;
}
