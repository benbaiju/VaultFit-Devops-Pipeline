import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
        <h2>Find Trainers</h2>
        <Link className="secondary-link" to="/bookings">
          Go to Bookings
        </Link>
      </div>
      <div className="grid">
        {(data ?? []).map((trainer) => (
          <article className="card trainer-card" key={trainer.id}>
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
          </article>
        ))}
      </div>
    </section>
  );
}
