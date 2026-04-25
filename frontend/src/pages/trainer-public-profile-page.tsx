import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
import { getTrainerById } from "../services/trainers";

export function TrainerPublicProfilePage() {
  const { trainerId } = useParams<{ trainerId: string }>();

  const trainerQuery = useQuery({
    queryKey: ["trainer", trainerId],
    queryFn: () => getTrainerById(trainerId ?? ""),
    enabled: Boolean(trainerId),
  });

  if (trainerQuery.isLoading) return <p>Loading trainer profile...</p>;
  if (trainerQuery.isError) return <p className="error">{(trainerQuery.error as Error).message}</p>;
  if (!trainerQuery.data) return <p className="muted">Trainer not found.</p>;

  const trainer = trainerQuery.data;

  return (
    <section>
      <div className="section-head">
        <h2>Trainer profile</h2>
        <Link className="secondary-link" to={ROUTES.client.book}>
          Book a session
        </Link>
      </div>

      <div className="card">
        <h3>{trainer.profiles?.full_name ?? "Unnamed Trainer"}</h3>
        <p>
          <span className={trainer.verified ? "badge badge-success" : "badge badge-muted"}>
            {trainer.verified ? "Verified" : "Unverified"}
          </span>
        </p>
        <p className="muted">Specialty: {trainer.specialty ?? "general"}</p>
        <p className="muted">Experience: {trainer.experience_years ?? 0} years</p>
        <p className="muted">Rate: ${trainer.hourly_rate}/hour</p>
        <p>{trainer.bio ?? "No bio yet."}</p>
      </div>
    </section>
  );
}
