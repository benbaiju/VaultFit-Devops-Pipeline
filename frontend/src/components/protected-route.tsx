import { Navigate, useLocation } from "react-router-dom";
import { defaultHomeForRole } from "../lib/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMyTrainerProfile } from "../services/trainers";
import { useAuth } from "../state/auth-context";
import type { Role } from "../types/api";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function RoleRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: Role[] }) {
  const { user } = useAuth();

  if (!user?.role) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={defaultHomeForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

export function TrainerVerifiedRoute({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const location = useLocation();

  const meQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
    enabled: user?.role === "trainer",
  });

  if (user?.role !== "trainer") return <>{children}</>;
  if (meQuery.isLoading) return <p>Checking verification status...</p>;
  if (meQuery.isError) return <p className="error">{(meQuery.error as Error).message}</p>;

  const me = meQuery.data;
  if (!me || !me.verified) {
    return <Navigate to="/trainer/profile" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
