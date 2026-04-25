import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "../lib/navigation";
import { getMyTrainerProfile } from "../services/trainers";
import { getBookings } from "../services/bookings";
import { useAuth } from "../state/auth-context";
import { 
  Users, Activity, CalendarClock, DollarSign, 
  ArrowRight, CheckCircle, Clock, Search 
} from "lucide-react";
import { format, isToday, parseISO } from "date-fns";

const MOD_CARDS = [
  { to: ROUTES.trainer.profile, title: "My Profile", body: "View/update profile and current verification status." },
  { to: ROUTES.trainer.services, title: "Services", body: "Define what you offer and pricing." },
  { to: ROUTES.trainer.bookings, title: "Session Requests", body: "Confirm or update booking status." },
  { to: ROUTES.trainer.plans, title: "Plans", body: "Assign programs to clients you work with." },
  { to: ROUTES.trainer.verification, title: "Verification", body: "Submit credentials for admin review." },
] as const;

export function TrainerDashboardPage() {
  const { token } = useAuth();
  
  const meQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
  });
  
  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const isVerified = meQuery.data?.verified === true;
  const visibleCards = MOD_CARDS.filter((c) => isVerified || c.to === ROUTES.trainer.profile || c.to === ROUTES.trainer.verification);
  
  const bookings = bookingsQuery.data ?? [];
  const todayBookings = bookings.filter(b => isToday(parseISO(b.booking_date)));
  const pendingBookings = bookings.filter(b => b.status === "pending");
  
  // Mock Metrics based on bookings
  const metrics = [
    { label: "Today's Sessions", value: todayBookings.length, icon: <CalendarClock className="text-accent" />, color: "border-accent" },
    { label: "Pending Requests", value: pendingBookings.length, icon: <Activity className="text-warning" />, color: "border-warning" },
    { label: "Total Clients", value: new Set(bookings.map(b => b.client_id)).size, icon: <Users className="text-primary" />, color: "border-primary" },
    { label: "Est. Weekly Income", value: `$${bookings.length * 50}`, icon: <DollarSign className="text-success" />, color: "border-success" },
  ];

  return (
    <section className="dashboard-container">
      <div className="section-head mb-6">
        <div>
          <h2 className="m-0 mb-1">Welcome back, {meQuery.data?.profiles?.full_name?.split(" ")[0] || "Trainer"}! 🚀</h2>
          <p className="muted m-0">Here's what's happening with your clients and schedule today.</p>
        </div>
        
        <div className={`status-pill ${isVerified ? 'verified' : 'unverified'}`}>
          {isVerified ? <CheckCircle size={16} /> : <Clock size={16} />}
          <span>{isVerified ? "Profile Verified" : "Pending Verification"}</span>
        </div>
      </div>

      {/* METRICS WIDGETS */}
      <div className="metrics-grid">
        {metrics.map((m, i) => (
          <div key={i} className={`metric-card ${m.color}`}>
            <div className="metric-header">
              <span className="metric-label">{m.label}</span>
              <div className="metric-icon-bg">{m.icon}</div>
            </div>
            <div className="metric-value">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-split">
        {/* AGENDA SECTION */}
        <div className="agenda-section">
          <div className="flex justify-between items-center mb-4">
            <h3 className="m-0">Today's Agenda</h3>
            <Link to={ROUTES.trainer.bookings} className="text-btn flex items-center gap-1 text-sm font-medium">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          
          <div className="card glass-card">
            {bookingsQuery.isLoading && <p className="muted">Loading agenda...</p>}
            {!bookingsQuery.isLoading && todayBookings.length === 0 && (
               <div className="empty-state">
                 <CalendarClock size={32} className="muted mb-2" />
                 <p className="font-medium mb-1">No sessions today</p>
                 <p className="muted text-sm m-0">You have a clear schedule. Take a break!</p>
               </div>
            )}
            
            <div className="agenda-list">
              {todayBookings.map(b => (
                <div key={b.id} className="agenda-item">
                  <div className="agenda-time">
                    <span className="font-medium text-lg">{b.start_time.slice(0,5)}</span>
                    <span className="muted text-xs">{b.end_time.slice(0,5)}</span>
                  </div>
                  <div className="agenda-divider"></div>
                  <div className="agenda-details">
                    <h4 className="m-0 mb-1">Client session</h4>
                    <div className="flex items-center gap-2">
                      <span className={`badge badge-${b.status === 'confirmed' ? 'success' : 'warning'}`}>{b.status}</span>
                      <span className="muted text-sm flex items-center gap-1"><Users size={12}/> Client booking</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS & MODULES */}
        <div className="modules-section">
          <h3 className="mb-4">Quick Access</h3>
          <div className="grid">
            {visibleCards.map((c) => (
              <Link key={c.to} to={c.to} className="card module-card">
                <h4>{c.title}</h4>
                <p className="muted text-sm m-0 mt-1">{c.body}</p>
                <div className="module-arrow">
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>
          
          {!isVerified && (
            <div className="locked-banner">
              <strong>Complete your onboarding!</strong>
              <p>Action required: Please complete your profile and verification to unlock client requests and services.</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .dashboard-container { max-width: 1200px; margin: 0 auto; }
        .mb-6 { margin-bottom: 1.5rem; }
        
        .status-pill { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 100px; font-weight: 600; font-size: 0.85rem; }
        .status-pill.verified { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-pill.unverified { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2.5rem; }
        .metric-card { background: var(--bg-card); border: 1px solid var(--border-light); padding: 1.25rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border-top-width: 3px; }
        .metric-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .metric-label { font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .metric-icon-bg { background: rgba(255,255,255,0.03); padding: 0.5rem; border-radius: 8px; }
        .metric-value { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; }
        
        .text-accent { color: var(--accent); }
        .text-warning { color: var(--warning); }
        .border-accent { border-top-color: var(--accent); }
        .border-warning { border-top-color: var(--warning); }
        .border-primary { border-top-color: var(--primary); }
        .border-success { border-top-color: var(--success); }
        
        .dashboard-split { display: grid; grid-template-columns: 1fr 1.3fr; gap: 2rem; }
        @media (max-width: 860px) { .dashboard-split { grid-template-columns: 1fr; } }
        
        .agenda-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .agenda-item { display: flex; gap: 1rem; padding: 1rem; background: rgba(255,255,255,0.02); border: 1px solid var(--border-light); border-radius: var(--radius-md); transition: background 0.2s; }
        .agenda-item:hover { background: rgba(255,255,255,0.04); }
        .agenda-time { display: flex; flex-direction: column; align-items: flex-end; min-width: 50px; }
        .agenda-divider { width: 2px; background: var(--primary); border-radius: 2px; opacity: 0.5; }
        .agenda-details { flex: 1; }
        
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1rem; text-align: center; border: 1px dashed var(--border-light); border-radius: var(--radius-md); background: rgba(0,0,0,0.1); }
        
        .module-card { cursor: pointer; position: relative; overflow: hidden; padding-bottom: 2rem; }
        .module-arrow { position: absolute; bottom: 1.25rem; right: 1.25rem; color: var(--primary); opacity: 0; transform: translateX(-10px); transition: all 0.2s; }
        .module-card:hover .module-arrow { opacity: 1; transform: translateX(0); }
        
        .locked-banner { background: rgba(245, 158, 11, 0.1); border: 1px dashed var(--warning); padding: 1.5rem; border-radius: var(--radius-md); margin-top: 1.5rem; }
        .locked-banner strong { color: var(--warning); display: block; margin-bottom: 0.5rem; }
        .locked-banner p { margin: 0; font-size: 0.9rem; color: var(--text-secondary); }
      `}</style>
    </section>
  );
}
