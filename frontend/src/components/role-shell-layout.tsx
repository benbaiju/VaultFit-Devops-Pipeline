import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ROUTES } from "../lib/navigation";
import { getMyTrainerProfile } from "../services/trainers";
import { useAuth } from "../state/auth-context";
import {
  Dumbbell,
  LayoutDashboard,
  User,
  CalendarDays,
  ClipboardCheck,
  MessageSquare,
  Bell,
  LogOut,
  Settings,
  ShieldCheck,
  Search,
  Bookmark,
  Activity,
  Menu,
  Users,
  BadgeCheck,
  Headset,
} from "lucide-react";

type ShellVariant = "client" | "trainer" | "admin";

export function RoleShellLayout({ variant }: { variant: ShellVariant }) {
  const { user, token, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const adminHeaderTitle = (() => {
    const p = location.pathname;
    if (p.startsWith(ROUTES.admin.users)) return "Users";
    if (p.startsWith(ROUTES.admin.verifications)) return "Verifications";
    if (p.startsWith(ROUTES.admin.support)) return "Support";
    if (p.startsWith(ROUTES.admin.settings)) return "Profile settings";
    return "Overview";
  })();

  const adminDisplayName = user?.full_name?.trim() || user?.email?.split("@")[0] || "Admin";
  
  const trainerMeQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
    enabled: variant === "trainer" && (user?.role === "trainer" || user?.role === "nutritionist"),
  });
  
  const trainerVerified = trainerMeQuery.data?.verified === true;

  const NavItem = ({ to, icon, label, end }: { to: string, icon: React.ReactNode, label: string, end?: boolean }) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );

  return (
    <div
      className={`dashboard-layout ${variant === "admin" ? "dashboard-layout--admin" : ""} ${sidebarOpen ? "" : "sidebar-hidden"}`}
    >
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Dumbbell className={`sidebar-logo-icon ${variant === "admin" ? "sidebar-logo-icon--admin" : ""}`} />
            <span className="sidebar-logo-text">VaultFit</span>
          </div>
          <div className="sidebar-header-controls">
            <span className="sidebar-role-badge">{user?.role ?? variant}</span>
          </div>
        </div>
        
        <div className="sidebar-scroll">
          <nav className="sidebar-nav">
            {variant === "client" && (
              <>
                <p className="sidebar-heading">Client Portal</p>
                <NavItem to={ROUTES.client.root} icon={<Search size={18}/>} label="Discover" end />
                <NavItem to={ROUTES.client.trainers} icon={<User size={18}/>} label="Trainers" />
                <NavItem to={ROUTES.client.nutritionists} icon={<Activity size={18}/>} label="Nutritionists" />
                <NavItem to={ROUTES.client.profile} icon={<User size={18}/>} label="My Profile" />
                <NavItem to={ROUTES.client.book} icon={<CalendarDays size={18}/>} label="Book Session" />
                <NavItem to={ROUTES.client.plans} icon={<Activity size={18}/>} label="My Plans" />
                <NavItem to={ROUTES.client.reviews} icon={<Bookmark size={18}/>} label="My Reviews" />
                <p className="sidebar-heading">Communication</p>
                <NavItem to={ROUTES.client.messages} icon={<MessageSquare size={18}/>} label="Messages" />
                <NavItem to={ROUTES.client.notifications} icon={<Bell size={18}/>} label="Notifications" />
                <NavItem to={ROUTES.client.support} icon={<ClipboardCheck size={18}/>} label="Support" />
              </>
            )}
            
            {variant === "trainer" && (
              <>
                <p className="sidebar-heading">{user?.role === "nutritionist" ? "Nutritionist Console" : "Trainer Console"}</p>
                <NavItem to={ROUTES.trainer.root} icon={<LayoutDashboard size={18}/>} label="Overview" end />
                <NavItem to={ROUTES.trainer.profile} icon={<User size={18}/>} label="My Profile" />
                {trainerVerified && (
                  <>
                    <NavItem to={ROUTES.trainer.servicesCreate} icon={<Settings size={18}/>} label="Services Setup" />
                    <NavItem to={ROUTES.trainer.bookings} icon={<CalendarDays size={18}/>} label="Session Requests" />
                    <NavItem to={ROUTES.trainer.plans} icon={<ClipboardCheck size={18}/>} label="Client Plans" />
                    <p className="sidebar-heading">Communication</p>
                    <NavItem to={ROUTES.trainer.messages} icon={<MessageSquare size={18}/>} label="Messages" />
                    <NavItem to={ROUTES.trainer.notifications} icon={<Bell size={18}/>} label="Notifications" />
                    <NavItem to={ROUTES.trainer.support} icon={<ClipboardCheck size={18}/>} label="Support" />
                  </>
                )}
                {!trainerVerified && (
                  <div className="sidebar-locked-msg">
                    <ShieldCheck size={16} />
                    <span>Get verified to unlock all modules.</span>
                  </div>
                )}
              </>
            )}
            
            {variant === "admin" && (
              <>
                <p className="sidebar-heading">Admin</p>
                <NavItem to={ROUTES.admin.root} icon={<LayoutDashboard size={18} />} label="Dashboard" end />
                <NavItem to={ROUTES.admin.users} icon={<Users size={18} />} label="Users" />
                <NavItem to={ROUTES.admin.verifications} icon={<BadgeCheck size={18} />} label="Verifications" />
                <NavItem to={ROUTES.admin.support} icon={<Headset size={18} />} label="Support" />
                <p className="sidebar-heading">Account</p>
                <NavItem to={ROUTES.admin.settings} icon={<Settings size={18} />} label="Profile settings" />
              </>
            )}
          </nav>
        </div>
        
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-email">{user?.email}</span>
              <span className="sidebar-user-status">Online</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout} aria-label="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="dashboard-main">
        <header className={`dashboard-header ${variant === "admin" ? "dashboard-header--admin" : ""}`}>
          <button
            className="dashboard-menu-btn"
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={sidebarOpen}
          >
            <Menu size={18} />
          </button>
          {variant === "admin" ? (
            <>
              <span className="dashboard-header-admin-crumb">{adminHeaderTitle}</span>
              <div className="dashboard-header-admin-spacer" />
              <div className="dashboard-header-admin-user">
                <div className="dashboard-header-admin-text">
                  <span className="dashboard-header-admin-name">{adminDisplayName}</span>
                  <span className="dashboard-header-admin-role">Super Admin</span>
                </div>
                <div className="dashboard-header-admin-avatar" aria-hidden>
                  {adminDisplayName.charAt(0).toUpperCase()}
                </div>
              </div>
            </>
          ) : (
            <div className="dashboard-header-title">
              <h2>
                {variant === "trainer" && user?.role === "nutritionist"
                  ? "Nutritionist Dashboard"
                  : `${variant.charAt(0).toUpperCase() + variant.slice(1)} Dashboard`}
              </h2>
            </div>
          )}
        </header>
        <div className={`dashboard-content ${variant === "admin" ? "dashboard-content--admin" : ""}`}>
          <Outlet />
        </div>
      </main>
      
      {/* DYNAMIC CSS FOR NEW LAYOUT */}
      <style>{`
        body { margin: 0; overflow: hidden; }
        .dashboard-layout {
          display: flex;
          height: 100vh;
          width: 100vw;
          background: var(--bg-main);
          overflow: hidden;
        }
        
        /* SIDEBAR STYLES */
        .sidebar {
          width: 280px;
          min-width: 280px;
          background: rgba(16, 21, 36, 0.75);
          backdrop-filter: blur(20px);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          z-index: 100;
          transition: width 0.24s ease, min-width 0.24s ease, border-color 0.24s ease;
          overflow: hidden;
        }
        .sidebar-header {
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-light);
          position: relative;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #fff;
        }
        .sidebar-logo-icon { color: var(--primary); }
        .sidebar-logo-icon--admin { color: #2ea043 !important; }
        .sidebar-logo-text { font-weight: 700; font-size: 1.2rem; letter-spacing: -0.02em; }
        .sidebar-role-badge {
          font-size: 0.65rem;
          text-transform: uppercase;
          background: var(--primary);
          color: white;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          font-weight: 800;
        }
        .sidebar-header-controls {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }
        .sidebar-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem 1rem;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .sidebar-heading {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin: 1.5rem 0 0.5rem 0.75rem;
          font-weight: 700;
        }
        .sidebar-heading:first-child { margin-top: 0; }
        
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          color: var(--text-secondary);
          text-decoration: none;
          border-radius: var(--radius-md);
          font-weight: 500;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        }
        .sidebar-link:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }
        .sidebar-link.active {
          background: linear-gradient(90deg, rgba(79, 70, 229, 0.15), transparent);
          color: #fff;
          border-left: 3px solid var(--primary);
        }
        .sidebar-link.active svg { color: var(--primary); }
        
        .sidebar-locked-msg {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(245, 158, 11, 0.1);
          color: var(--warning);
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          margin-top: 1rem;
        }
        
        .sidebar-footer {
          padding: 1.25rem;
          border-top: 1px solid var(--border-light);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
        }
        .sidebar-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .sidebar-user-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .sidebar-user-email {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-user-status {
          font-size: 0.75rem;
          color: var(--success);
        }
        .sidebar-logout {
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 0.5rem;
          border-radius: var(--radius-md);
        }
        .sidebar-logout:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
        }
        
        /* MAIN AREA STYLES */
        .dashboard-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }
        .dashboard-header {
          height: 70px;
          border-bottom: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0 1.5rem;
          backdrop-filter: blur(10px);
          z-index: 10;
        }
        .dashboard-menu-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          flex-shrink: 0;
        }
        .dashboard-menu-btn:hover {
          color: #fff;
          border-color: var(--border-color);
          background: rgba(255, 255, 255, 0.08);
        }
        .dashboard-header h2 { margin: 0; font-size: 1.1rem; }

        .dashboard-header--admin {
          border-bottom-color: rgba(139, 148, 158, 0.12);
          background: rgba(11, 14, 20, 0.85);
        }
        .dashboard-header-admin-crumb {
          font-size: 0.95rem;
          font-weight: 600;
          color: #e6edf3;
          letter-spacing: 0.02em;
        }
        .dashboard-header-admin-spacer { flex: 1; }
        .dashboard-header-admin-user {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .dashboard-header-admin-text {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.1rem;
        }
        .dashboard-header-admin-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: #e6edf3;
        }
        .dashboard-header-admin-role {
          font-size: 0.72rem;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .dashboard-header-admin-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(145deg, #238636, #2ea043);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.95rem;
          border: 1px solid rgba(139, 148, 158, 0.25);
        }
        
        .dashboard-content {
          flex: 1;
          overflow-y: auto;
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }
        .dashboard-content--admin {
          max-width: none;
          margin: 0;
          padding: 1.5rem 2rem 2.5rem;
        }
        .dashboard-layout--admin {
          background: #0b0e14;
        }
        .dashboard-layout--admin .sidebar {
          background: #0d1117;
          border-right-color: rgba(139, 148, 158, 0.12);
        }
        .dashboard-layout--admin .sidebar-link.active {
          background: rgba(56, 139, 253, 0.12);
          border-left: 3px solid #58a6ff;
          color: #e6edf3;
        }
        .dashboard-layout--admin .sidebar-link.active svg {
          color: #58a6ff;
        }
        .dashboard-layout.sidebar-hidden .sidebar {
          width: 0;
          min-width: 0;
          border-right-color: transparent;
        }
        .dashboard-layout.sidebar-hidden .sidebar > * {
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
