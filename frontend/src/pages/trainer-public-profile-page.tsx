import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
import { getTrainerReviews } from "../services/reviews";
import { getTrainerById } from "../services/trainers";

export function TrainerPublicProfilePage() {
  const { trainerId } = useParams<{ trainerId: string }>();

  const trainerQuery = useQuery({
    queryKey: ["trainer", trainerId],
    queryFn: () => getTrainerById(trainerId ?? ""),
    enabled: Boolean(trainerId),
  });
  const reviewsQuery = useQuery({
    queryKey: ["reviews", trainerId],
    queryFn: () => getTrainerReviews(trainerId ?? ""),
    enabled: Boolean(trainerId),
  });

  if (trainerQuery.isLoading) return <p>Loading trainer profile...</p>;
  if (trainerQuery.isError) return <p className="error">{(trainerQuery.error as Error).message}</p>;
  if (!trainerQuery.data) return <p className="muted">Trainer not found.</p>;

  const trainer = trainerQuery.data;
  const trainerReviews = reviewsQuery.data ?? [];
  const averageRating =
    trainerReviews.length > 0
      ? trainerReviews.reduce((sum, review) => sum + review.rating, 0) / trainerReviews.length
      : 0;
  const roundedRating = Math.round(averageRating);
  const displayName = trainer.profiles?.full_name ?? "Unnamed Trainer";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section>
      <div className="section-head">
        <h2>Trainer profile</h2>
        <Link className="secondary-link" to={ROUTES.client.book}>
          Book a session
        </Link>
      </div>

      <div className="trainer-profile-hero card">
        <div className="trainer-profile-avatar">{initials || "TR"}</div>
        <div className="trainer-profile-main">
          <div className="trainer-profile-heading">
            <h3>{displayName}</h3>
            <span className={trainer.verified ? "badge badge-success" : "badge badge-muted"}>
              {trainer.verified ? "Verified" : "Unverified"}
            </span>
          </div>
          <p className="muted trainer-profile-subtitle">
            {trainer.specialty ?? "General fitness"} trainer
          </p>
          <div className="trainer-profile-rating">
            <span className="trainer-profile-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  fill={star <= roundedRating ? "currentColor" : "none"}
                  style={{ color: star <= roundedRating ? "#f59e0b" : "#64748b" }}
                />
              ))}
            </span>
            <span className="muted">
              {trainerReviews.length > 0
                ? `${averageRating.toFixed(1)} / 5 (${trainerReviews.length} review${trainerReviews.length > 1 ? "s" : ""})`
                : "No reviews yet"}
            </span>
          </div>
          <p className="trainer-profile-bio">{trainer.bio ?? "This trainer has not added a bio yet."}</p>
          <div className="trainer-profile-actions">
            <Link className="primary-btn" to={`${ROUTES.client.book}?with=trainer&trainerId=${trainer.id}`}>
              Book with this trainer
            </Link>
            <Link className="secondary-link" to={ROUTES.client.trainers}>
              Back to all trainers
            </Link>
          </div>
        </div>
      </div>

      <div className="trainer-metrics-grid">
        <article className="card trainer-metric-card">
          <p className="trainer-metric-label">Hourly rate</p>
          <p className="trainer-metric-value">${trainer.hourly_rate}</p>
          <p className="muted">per hour</p>
        </article>
        <article className="card trainer-metric-card">
          <p className="trainer-metric-label">Experience</p>
          <p className="trainer-metric-value">{trainer.experience_years ?? 0}</p>
          <p className="muted">years</p>
        </article>
        <article className="card trainer-metric-card">
          <p className="trainer-metric-label">Specialty</p>
          <p className="trainer-metric-value trainer-metric-value-sm">{trainer.specialty ?? "General"}</p>
          <p className="muted">focus area</p>
        </article>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Client reviews</h3>
        {reviewsQuery.isLoading ? <p>Loading reviews...</p> : null}
        {!reviewsQuery.isLoading && trainerReviews.length === 0 ? <p className="muted">No reviews yet.</p> : null}
        <ul className="list">
          {trainerReviews.map((review) => (
            <li key={review.id}>
              <span>
                <span style={{ display: "inline-flex", gap: "0.1rem", verticalAlign: "middle", marginRight: "0.3rem" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={14}
                      fill={star <= review.rating ? "currentColor" : "none"}
                      style={{ color: star <= review.rating ? "#f59e0b" : "#64748b" }}
                    />
                  ))}
                </span>
                ({review.rating}/5) - {review.comment ?? "No comment"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <style>{`
        .trainer-profile-hero {
          display: grid;
          grid-template-columns: 84px 1fr;
          gap: 1rem;
          align-items: start;
          margin-bottom: 1rem;
        }
        .trainer-profile-avatar {
          width: 84px;
          height: 84px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.2rem;
          color: #fff;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          box-shadow: 0 8px 24px rgba(79, 70, 229, 0.35);
        }
        .trainer-profile-main h3 {
          margin: 0;
          font-size: 1.5rem;
        }
        .trainer-profile-heading {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .trainer-profile-subtitle {
          margin: 0.35rem 0 0.75rem;
          text-transform: capitalize;
        }
        .trainer-profile-bio {
          margin: 0 0 1rem;
          line-height: 1.55;
        }
        .trainer-profile-rating {
          margin: 0 0 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .trainer-profile-stars {
          display: inline-flex;
          gap: 0.12rem;
        }
        .trainer-profile-actions {
          display: flex;
          gap: 0.85rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .trainer-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 0.9rem;
        }
        .trainer-metric-card {
          text-align: center;
        }
        .trainer-metric-label {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 700;
        }
        .trainer-metric-value {
          margin: 0.3rem 0 0.2rem;
          font-size: 1.7rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.1;
        }
        .trainer-metric-value-sm {
          font-size: 1.05rem;
          text-transform: capitalize;
        }
      `}</style>
    </section>
  );
}
