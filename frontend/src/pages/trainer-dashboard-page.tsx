import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "../lib/navigation";
import { getMyTrainerProfile } from "../services/trainers";
import { useAuth } from "../state/auth-context";

const cards = [
  { to: ROUTES.trainer.profile, title: "My profile", body: "View/update profile and current verification status." },
  { to: ROUTES.trainer.services, title: "Services", body: "Define what you offer and pricing." },
  { to: ROUTES.trainer.bookings, title: "Session requests", body: "Confirm or update booking status." },
  { to: ROUTES.trainer.plans, title: "Plans", body: "Assign programs to clients you work with." },
  { to: ROUTES.trainer.verification, title: "Verification", body: "Submit credentials for admin review." },
  { to: ROUTES.trainer.messages, title: "Messages", body: "Chat with clients." },
  { to: ROUTES.trainer.notifications, title: "Notifications", body: "Stay on top of alerts." },
] as const;

export function TrainerDashboardPage() {
  const { token } = useAuth();
  const meQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
  });
  const isVerified = meQuery.data?.verified === true;
  const visibleCards = cards.filter((c) => isVerified || c.to === ROUTES.trainer.profile || c.to === ROUTES.trainer.verification);
  const lockedCards = cards.filter((c) => !visibleCards.some((v) => v.to === c.to));

  return (
    <section>
      <div className="section-head">
        <h2>Trainer overview</h2>
      </div>
      <p className="muted">Manage your profile, verification, clients, and day-to-day operations from one place.</p>

      <div className="card trainer-status-card">
        <h3>Account status</h3>
        {meQuery.isLoading ? <p className="muted">Loading profile status...</p> : null}
        {meQuery.isSuccess ? (
          <>
            <p>
              Verification:{" "}
              <span className={isVerified ? "badge badge-success" : "badge badge-muted"}>
                {isVerified ? "Profile verified" : "Pending verification"}
              </span>
            </p>
            {!isVerified ? (
              <p className="muted">
                You can complete <b>My profile</b> and <b>Verification</b> now. Operational modules unlock after admin approval.
              </p>
            ) : (
              <p className="muted">All trainer modules are active.</p>
            )}
          </>
        ) : null}
      </div>

      <div className="grid">
        {visibleCards.map((c) => (
          <Link key={c.to} to={c.to} className="card trainer-card dashboard-link-card" style={{ textDecoration: "none", color: "inherit" }}>
            <h3>{c.title}</h3>
            <p className="muted">{c.body}</p>
          </Link>
        ))}
      </div>

      {!isVerified && lockedCards.length > 0 ? (
        <div className="card">
          <h3>Locked until verified</h3>
          <p className="muted">These modules will unlock automatically after admin approval:</p>
          <div className="inline-actions">
            {lockedCards.map((c) => (
              <span key={c.to} className="badge badge-muted">
                {c.title}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
