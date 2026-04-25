import { Navigate } from "react-router-dom";
import { defaultHomeForRole, ROUTES } from "../lib/navigation";
import { useAuth } from "../state/auth-context";

/** Logged-out users → login; logged-in users → role home. */
export function AuthHomeRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace />;
  }
  return <Navigate to={defaultHomeForRole(user?.role)} replace />;
}
