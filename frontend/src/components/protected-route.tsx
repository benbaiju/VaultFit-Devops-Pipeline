import { Navigate, useLocation } from "react-router-dom";
import { defaultHomeForRole } from "../lib/navigation";
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
