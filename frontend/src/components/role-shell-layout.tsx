import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "../lib/navigation";
import { getMyTrainerProfile } from "../services/trainers";
import { useAuth } from "../state/auth-context";
import { 
  Dumbbell, LayoutDashboard, User, CalendarDays, ClipboardCheck, 
  MessageSquare, Bell, LogOut, Settings, ShieldCheck, Home, 
  Search, Bookmark, Activity 
} from "lucide-react";

type ShellVariant = "client" | "trainer" | "admin";

export function RoleShellLayout({ variant }: { variant: ShellVariant }) {
  const { user, token, logout } = useAuth();
  
  const trainerMeQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
    enabled: variant === "trainer" && user?.role === "trainer",
  });
  
  const trainerVerified = trainerMeQuery.data?.verified === true;

  const NavItem = ({ to, icon, label, end }: { to: string, icon: React.ReactNode, label: string, end?: boolean }) => (
    <NavLink to={to} end={end} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
      {icon}
      <span>{label}</span>
    </NavLink>
  );

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Dumbbell className="sidebar-logo-icon" />
            <span className="sidebar-logo-text">VaultFit Pro</span>
          </div>
          <span className="sidebar-role-badge">{variant}</span>
        </div>
        
        <div className="sidebar-scroll">
          <nav className="sidebar-nav">
            {variant === "client" && (
              <>
                <p className="sidebar-heading">Client Portal</p>
                <NavItem to={ROUTES.client.root} icon={<Search size={18}/>} label="Discover" end />
                <NavItem to={ROUTES.client.profile} icon={<User size={18}/>} label="My Profile" />
                <NavItem to={ROUTES.client.book} icon={<CalendarDays size={18}/>} label="Book Session" />
                <NavItem to={ROUTES.client.plans} icon={<Activity size={18}/>} label="My Plans" />
                <NavItem to={ROUTES.client.reviews} icon={<Bookmark size={18}/>} label="My Reviews" />
                <p className="sidebar-heading">Communication</p>
                <NavItem to={ROUTES.client.messages} icon={<MessageSquare size={18}/>} label="Messages" />
                <NavItem to={ROUTES.client.notifications} icon={<Bell size={18}/>} label="Notifications" />
              </>
            )}
            
            {variant === "trainer" && (
              <>
                <p className="sidebar-heading">Trainer Console</p>
                <NavItem to={ROUTES.trainer.root} icon={<LayoutDashboard size={18}/>} label="Overview" end />
                <NavItem to={ROUTES.trainer.profile} icon={<User size={18}/>} label="My Profile" />
                {trainerVerified && (
                  <>
                    <NavItem to={ROUTES.trainer.services} icon={<Settings size={18}/>} label="Services Setup" />
                    <NavItem to={ROUTES.trainer.bookings} icon={<CalendarDays size={18}/>} label="Session Requests" />
                    <NavItem to={ROUTES.trainer.plans} icon={<ClipboardCheck size={18}/>} label="Client Plans" />
                    <p className="sidebar-heading">Communication</p>
                    <NavItem to={ROUTES.trainer.messages} icon={<MessageSquare size={18}/>} label="Messages" />
                    <NavItem to={ROUTES.trainer.notifications} icon={<Bell size={18}/>} label="Notifications" />
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
                <p className="sidebar-heading">Admin Console</p>
                <NavItem to={ROUTES.admin.root} icon={<ShieldCheck size={18}/>} label="Control Center" end />
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
        <header className="dashboard-header">
          <div className="dashboard-header-title">
            <h2>{variant.charAt(0).toUpperCase() + variant.slice(1)} Dashboard</h2>
          </div>
        </header>
        <div className="dashboard-content">
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
        }
        
        /* SIDEBAR STYLES */
        .sidebar {
          width: 280px;
          background: rgba(16, 21, 36, 0.75);
          backdrop-filter: blur(20px);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          z-index: 100;
        }
        .sidebar-header {
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-light);
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #fff;
        }
        .sidebar-logo-icon { color: var(--primary); }
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
          padding: 0 2rem;
          backdrop-filter: blur(10px);
          z-index: 10;
        }
        .dashboard-header h2 { margin: 0; font-size: 1.1rem; }
        
        .dashboard-content {
          flex: 1;
          overflow-y: auto;
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
