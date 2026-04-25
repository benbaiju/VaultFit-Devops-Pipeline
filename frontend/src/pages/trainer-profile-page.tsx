import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
import { getTrainerReviews } from "../services/reviews";
import { createMyTrainerProfile, getMyTrainerProfile, updateMyTrainerProfile } from "../services/trainers";
import { getMyVerificationRequests } from "../services/verification";
import { useAuth } from "../state/auth-context";

export function TrainerProfilePage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [experienceYears, setExperienceYears] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(90);
  const [error, setError] = useState("");

  const meQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
  });

  const verificationQuery = useQuery({
    queryKey: ["trainer-verification-requests"],
    queryFn: () => getMyVerificationRequests(token),
  });
  const reviewsQuery = useQuery({
    queryKey: ["reviews", meQuery.data?.id ?? ""],
    queryFn: () => getTrainerReviews(meQuery.data!.id),
    enabled: Boolean(meQuery.data?.id),
  });

  useEffect(() => {
    const me = meQuery.data;
    if (!me) return;
    setBio(me.bio ?? "");
    setSpecialty(me.specialty ?? "");
    setExperienceYears(me.experience_years ?? 0);
    setHourlyRate(me.hourly_rate ?? 0);
  }, [meQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { bio, specialty, experienceYears, hourlyRate };
      if (meQuery.data?.id) {
        return updateMyTrainerProfile(token, meQuery.data.id, payload);
      }
      return createMyTrainerProfile(token, payload);
    },
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["trainer-me"] });
      void queryClient.invalidateQueries({ queryKey: ["trainers"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  const latestVerification = (verificationQuery.data ?? [])[0];
  const isVerified = Boolean(meQuery.data?.verified);

  return (
    <section>
      <h2>My profile</h2>
      <p className="muted">Complete your trainer or nutritionist profile and submit verification to unlock platform features.</p>

      <div className="card">
        <h3>Verification status</h3>
        {meQuery.isLoading ? <p>Loading profile...</p> : null}
        {!meQuery.isLoading && !meQuery.data ? <p className="muted">No profile yet. Create it below, then submit verification.</p> : null}
        {meQuery.data ? (
          <p>
            Profile status:{" "}
            <span className={isVerified ? "badge badge-success" : "badge badge-muted"}>
              {isVerified ? "Verified" : "Not verified"}
            </span>
          </p>
        ) : null}
        {latestVerification ? (
          <p className="muted">
            Latest verification request: <b className={`status status-${latestVerification.status}`}>{latestVerification.status}</b> (
            {new Date(latestVerification.submitted_at).toLocaleString()})
          </p>
        ) : (
          <p className="muted">No verification request submitted yet.</p>
        )}
        <Link className="secondary-link" to={ROUTES.trainer.verification}>
          Open verification submission
        </Link>
      </div>

      <div className="card">
        <h3>{meQuery.data ? "Edit profile" : "Create profile"}</h3>
        <label>Specialty</label>
        <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="strength, nutritionist, rehab..." />
        <label>Bio</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Describe your experience and approach" />
        <label>Experience years</label>
        <input type="number" min={0} value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value || 0))} />
        <label>Hourly rate (AUD)</label>
        <input type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value || 0))} />
        <button className="primary-btn" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : meQuery.data ? "Update profile" : "Create profile"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="card">
        <h3>Client reviews</h3>
        <p className="muted">Feedback from clients on completed bookings.</p>
        {reviewsQuery.isLoading ? <p>Loading reviews...</p> : null}
        {!reviewsQuery.isLoading && (reviewsQuery.data ?? []).length === 0 ? (
          <p className="muted">No client reviews yet.</p>
        ) : null}
        <ul className="list">
          {(reviewsQuery.data ?? []).map((review) => (
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
    </section>
  );
}

