import { NavLink, Outlet } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
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
  const { user, logout } = useAuth();
  const meta = SHELL_META[variant];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <p className="brand-pill">VaultFit Pro</p>
          <h1>{meta.title}</h1>
          <p className="muted">{meta.subtitle}</p>
          <p className="muted">
            Signed in as {user?.email ?? "-"} ({user?.role ?? "-"})
          </p>
        </div>
        <nav className="nav">
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
              <NavLink to={ROUTES.trainer.services}>Services</NavLink>
              <NavLink to={ROUTES.trainer.bookings}>Session requests</NavLink>
              <NavLink to={ROUTES.trainer.plans}>Plans</NavLink>
              <NavLink to={ROUTES.trainer.messages}>Messages</NavLink>
              <NavLink to={ROUTES.trainer.notifications}>Notifications</NavLink>
              <NavLink to={ROUTES.trainer.verification}>Verification</NavLink>
            </>
          ) : null}
          {variant === "admin" ? (
            <NavLink to={ROUTES.admin.root} end>
              Console
            </NavLink>
          ) : null}
          <button className="secondary-btn" type="button" onClick={logout}>
            Logout
          </button>
        </nav>
      </header>
      <section className="content">
        <Outlet />
      </section>
    </main>
  );
}
