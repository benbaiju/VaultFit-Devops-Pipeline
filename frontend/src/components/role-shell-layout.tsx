import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "../lib/navigation";
import { getMyTrainerProfile } from "../services/trainers";
import { useAuth } from "../state/auth-context";

type ShellVariant = "client" | "trainer" | "admin";

const SHELL_META: Record<ShellVariant, { title: string; subtitle: string }> = {
  client: {
    title: "VaultFit",
    subtitle: "Discover trainers, book sessions, and stay on track.",
  },
  trainer: {
    title: "VaultFit",
    subtitle: "Manage your services, sessions, and client plans.",
  },
  admin: {
    title: "VaultFit",
    subtitle: "Review credentials and directory access.",
  },
};

export function RoleShellLayout({ variant }: { variant: ShellVariant }) {
  const { user, token, logout } = useAuth();
  const meta = SHELL_META[variant];
  const trainerMeQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
    enabled: variant === "trainer" && user?.role === "trainer",
  });
  const trainerVerified = trainerMeQuery.data?.verified === true;

  return (
    <main className="app-shell">
      <header className={`topbar topbar-${variant}`}>
        <div className="brand-wrap">
          <p className="brand-pill">VaultFit Pro</p>
          <h1>{meta.title}</h1>
          <p className="muted">{meta.subtitle}</p>
          <p className="muted">
            Signed in as {user?.email ?? "-"} ({user?.role ?? "-"})
          </p>
        </div>
        <nav className="nav role-nav">
          <div className="role-nav-links">
            {variant === "client" ? (
              <>
                <NavLink to={ROUTES.client.root} end>
                  Discover
                </NavLink>
                <NavLink to={ROUTES.client.book}>Book a session</NavLink>
                <NavLink to={ROUTES.client.plans}>My plans</NavLink>
                <NavLink to={ROUTES.client.reviews}>My reviews</NavLink>
                <NavLink to={ROUTES.client.messages}>Messages</NavLink>
                <NavLink to={ROUTES.client.notifications}>Notifications</NavLink>
              </>
            ) : null}
            {variant === "trainer" ? (
              <>
                <NavLink to={ROUTES.trainer.root} end>
                  Overview
                </NavLink>
                <NavLink to={ROUTES.trainer.profile}>My profile</NavLink>
                {trainerVerified ? <NavLink to={ROUTES.trainer.services}>Services</NavLink> : null}
                {trainerVerified ? <NavLink to={ROUTES.trainer.bookings}>Session requests</NavLink> : null}
                {trainerVerified ? <NavLink to={ROUTES.trainer.plans}>Plans</NavLink> : null}
                {trainerVerified ? <NavLink to={ROUTES.trainer.messages}>Messages</NavLink> : null}
                {trainerVerified ? <NavLink to={ROUTES.trainer.notifications}>Notifications</NavLink> : null}
              </>
            ) : null}
            {variant === "admin" ? (
              <NavLink to={ROUTES.admin.root} end>
                Console
              </NavLink>
            ) : null}
          </div>
          <div className="role-nav-actions">
            <button className="secondary-btn nav-logout-btn" type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </nav>
      </header>
      <section className="content">
        <Outlet />
      </section>
    </main>
  );
}
