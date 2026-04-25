import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
import { getTrainers } from "../services/trainers";

export function HomePage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const filteredTrainers = useMemo(() => {
    const trainers = data ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return trainers;
    return trainers.filter((trainer) => {
      const name = trainer.profiles?.full_name ?? "";
      const specialty = trainer.specialty ?? "";
      const bio = trainer.bio ?? "";
      return [name, specialty, bio].some((field) => field.toLowerCase().includes(query));
    });
  }, [data, search]);

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
      <div className="card" style={{ marginBottom: "1rem" }}>
        <label>Search trainers</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, specialty, or bio..."
        />
        <p className="muted" style={{ marginBottom: 0 }}>
          Showing {filteredTrainers.length} of {(data ?? []).length} trainers
        </p>
      </div>
      <div className="grid">
        {filteredTrainers.map((trainer) => (
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
        {filteredTrainers.length === 0 ? <p className="muted">No trainers match your search.</p> : null}
      </div>
    </section>
  );
}
