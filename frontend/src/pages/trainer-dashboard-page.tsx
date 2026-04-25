import { Link } from "react-router-dom";
import { ROUTES } from "../lib/navigation";

const cards = [
  { to: ROUTES.trainer.services, title: "Services", body: "Define what you offer and pricing." },
  { to: ROUTES.trainer.bookings, title: "Session requests", body: "Confirm or update booking status." },
  { to: ROUTES.trainer.plans, title: "Plans", body: "Assign programs to clients you work with." },
  { to: ROUTES.trainer.verification, title: "Verification", body: "Submit credentials for admin review." },
  { to: ROUTES.trainer.messages, title: "Messages", body: "Chat with clients." },
  { to: ROUTES.trainer.notifications, title: "Notifications", body: "Stay on top of alerts." },
] as const;

export function TrainerDashboardPage() {
  return (
    <section>
      <h2>Trainer overview</h2>
      <p className="muted">Jump into the areas you use day to day. Client discovery stays on the client app; you run your practice from here.</p>
      <div className="grid">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="card trainer-card" style={{ textDecoration: "none", color: "inherit" }}>
            <h3>{c.title}</h3>
            <p className="muted">{c.body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
