import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
import { getTrainers } from "../services/trainers";

export function HomePage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  if (isLoading) return <p>Loading trainers...</p>;
  if (isError) return <p className="error">{(error as Error).message}</p>;

  return (
    <section>
      <div className="section-head">
        <h2>Find trainers</h2>
        <Link className="secondary-link" to={ROUTES.client.book}>
          Book a session
        </Link>
      </div>
      <div className="grid">
        {(data ?? []).map((trainer) => (
          <Link
            key={trainer.id}
            className="card trainer-card"
            to={`${ROUTES.client.trainers}/${trainer.id}`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <div className="trainer-card-top">
              <h3>{trainer.profiles?.full_name ?? "Unnamed Trainer"}</h3>
              <span className={trainer.verified ? "badge badge-success" : "badge badge-muted"}>
                {trainer.verified ? "Verified" : "Unverified"}
              </span>
            </div>
            <p className="muted">Specialty: {trainer.specialty ?? "general"}</p>
            <p className="muted">Rate: ${trainer.hourly_rate}/hour</p>
            <p>{trainer.bio ?? "No bio yet."}</p>
            <p className="muted">ID: {trainer.id}</p>
            <p className="muted">Click to view full profile</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
