import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
import { getTrainers } from "../services/trainers";

function isNutritionSpecialty(value: string | null | undefined): boolean {
  const text = (value ?? "").toLowerCase();
  return text.includes("nutri") || text.includes("diet") || text.includes("meal");
}

export function HomePage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const filteredProfessionals = useMemo(() => {
    const professionals = data ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return professionals;
    return professionals.filter((trainer) => {
      const name = trainer.profiles?.full_name ?? "";
      const specialty = trainer.specialty ?? "";
      const bio = trainer.bio ?? "";
      return [name, specialty, bio].some((field) => field.toLowerCase().includes(query));
    });
  }, [data, search]);
  const nutritionists = useMemo(
    () =>
      filteredProfessionals.filter(
        (trainer) => trainer.profiles?.role === "nutritionist" || isNutritionSpecialty(trainer.specialty),
      ),
    [filteredProfessionals],
  );
  const trainers = useMemo(
    () => filteredProfessionals.filter((trainer) => !nutritionists.some((n) => n.id === trainer.id)),
    [filteredProfessionals, nutritionists],
  );

  if (isLoading) return <p>Loading trainers...</p>;
  if (isError) return <p className="error">{(error as Error).message}</p>;

  return (
    <section>
      <div className="section-head">
        <h2>Find professionals</h2>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <Link className="secondary-link" to={ROUTES.client.nutritionists}>
            Browse nutritionists
          </Link>
          <Link className="secondary-link" to={ROUTES.client.book}>
            Book a session
          </Link>
        </div>
      </div>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <label>Search trainers and nutritionists</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, specialty, or bio..."
        />
        <p className="muted" style={{ marginBottom: 0 }}>
          Showing {filteredProfessionals.length} of {(data ?? []).length} professionals
        </p>
      </div>
      <h3 style={{ margin: "0.4rem 0 0.75rem" }}>Trainers</h3>
      <div className="grid" style={{ marginBottom: "1.25rem" }}>
        {trainers.map((trainer) => (
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
            <p className="muted">Click to view full profile</p>
          </Link>
        ))}
        {trainers.length === 0 ? <p className="muted">No trainers match your search.</p> : null}
      </div>
      <h3 style={{ margin: "0.2rem 0 0.75rem" }}>Nutritionists</h3>
      <div className="grid">
        {nutritionists.map((trainer) => (
          <Link
            key={trainer.id}
            className="card trainer-card"
            to={`${ROUTES.client.trainers}/${trainer.id}`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <div className="trainer-card-top">
              <h3>{trainer.profiles?.full_name ?? "Unnamed Nutritionist"}</h3>
              <span className={trainer.verified ? "badge badge-success" : "badge badge-muted"}>
                {trainer.verified ? "Verified" : "Unverified"}
              </span>
            </div>
            <p className="muted">Specialty: {trainer.specialty ?? "nutrition"}</p>
            <p className="muted">Rate: ${trainer.hourly_rate}/hour</p>
            <p>{trainer.bio ?? "No bio yet."}</p>
            <p className="muted">Click to view full profile</p>
          </Link>
        ))}
        {nutritionists.length === 0 ? <p className="muted">No nutritionists match your search.</p> : null}
      </div>
    </section>
  );
}
