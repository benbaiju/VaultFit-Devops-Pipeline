import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
import { getTrainers } from "../services/trainers";

function isNutritionSpecialty(value: string | null | undefined): boolean {
  const text = (value ?? "").toLowerCase();
  return text.includes("nutri") || text.includes("diet") || text.includes("meal");
}

export function NutritionistsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const nutritionists = useMemo(() => (data ?? []).filter((trainer) => isNutritionSpecialty(trainer.specialty)), [data]);

  const filteredNutritionists = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return nutritionists;
    return nutritionists.filter((trainer) => {
      const name = trainer.profiles?.full_name ?? "";
      const specialty = trainer.specialty ?? "";
      const bio = trainer.bio ?? "";
      return [name, specialty, bio].some((field) => field.toLowerCase().includes(query));
    });
  }, [nutritionists, search]);

  if (isLoading) return <p>Loading nutritionists...</p>;
  if (isError) return <p className="error">{(error as Error).message}</p>;

  return (
    <section>
      <div className="section-head">
        <h2>Find nutritionists</h2>
        <Link className="secondary-link" to={ROUTES.client.book}>
          Book a session
        </Link>
      </div>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <label>Search nutritionists</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, specialty, or bio..."
        />
        <p className="muted" style={{ marginBottom: 0 }}>
          Showing {filteredNutritionists.length} of {nutritionists.length} nutritionists
        </p>
      </div>
      <div className="grid">
        {filteredNutritionists.map((trainer) => (
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
        {filteredNutritionists.length === 0 ? (
          <p className="muted">No nutritionists match your search right now.</p>
        ) : null}
      </div>
    </section>
  );
}
