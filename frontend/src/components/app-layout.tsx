import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../state/auth-context";

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <p className="brand-pill">VaultFit Pro</p>
          <h1>Fitness Marketplace Admin</h1>
          <p className="muted">Signed in as {user?.email ?? "-"} ({user?.role ?? "-"})</p>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Trainers
          </NavLink>
          <NavLink to="/bookings">Bookings</NavLink>
          <button className="secondary-btn" onClick={logout}>
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
