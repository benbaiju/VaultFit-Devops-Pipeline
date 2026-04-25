import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getBookings } from "../services/bookings";
import { getTrainerReviews } from "../services/reviews";
import { getTrainers } from "../services/trainers";
import { getMyProfile, updateMyProfile } from "../services/profiles";
import { useAuth } from "../state/auth-context";

function StarDisplay({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", gap: "0.1rem", verticalAlign: "middle" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          fill={star <= value ? "currentColor" : "none"}
          style={{ color: star <= value ? "#f59e0b" : "#64748b" }}
        />
      ))}
    </span>
  );
}

export function ClientProfilePage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");

  const profileQuery = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => getMyProfile(token),
  });
  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });
  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });
  const completedBookings = useMemo(
    () => (bookingsQuery.data ?? []).filter((booking) => booking.status === "completed"),
    [bookingsQuery.data],
  );
  const completedTrainerIds = useMemo(
    () =>
      Array.from(
        new Set(completedBookings.map((booking) => booking.trainer_id).filter((id): id is string => Boolean(id))),
      ),
    [completedBookings],
  );
  const reviewsByCompletedTrainer = useQueries({
    queries: completedTrainerIds.map((trainerId) => ({
      queryKey: ["reviews", trainerId],
      queryFn: () => getTrainerReviews(trainerId),
      enabled: Boolean(user?.id),
    })),
  });
  const trainerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (trainersQuery.data ?? []).forEach((trainer) => {
      map.set(trainer.id, trainer.profiles?.full_name ?? "Trainer");
    });
    return map;
  }, [trainersQuery.data]);
  const myReviews = useMemo(() => {
    const rows: Array<{ id: string; bookingId: string; trainerName: string; rating: number; comment: string | null }> = [];
    reviewsByCompletedTrainer.forEach((query) => {
      (query.data ?? []).forEach((review) => {
        if (review.client_id !== user?.id) return;
        rows.push({
          id: review.id,
          bookingId: review.booking_id,
          trainerName: trainerNameById.get(review.trainer_id) ?? "Trainer",
          rating: review.rating,
          comment: review.comment,
        });
      });
    });
    return rows;
  }, [reviewsByCompletedTrainer, trainerNameById, user?.id]);
  const profileDisplayName = profileQuery.data?.full_name?.trim() || user?.full_name || user?.email || "Client";
  const roleLabel = profileQuery.data?.role ? `${profileQuery.data.role.charAt(0).toUpperCase()}${profileQuery.data.role.slice(1)}` : "Client";

  useEffect(() => {
    if (!profileQuery.data) return;
    setFullName(profileQuery.data.full_name ?? "");
    setPhone(profileQuery.data.phone ?? "");
    setTimezone(profileQuery.data.timezone ?? "");
    setAvatarUrl(profileQuery.data.avatar_url ?? "");
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMyProfile(token, {
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        timezone: timezone.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      }),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <section>
      <h2>{`Hi, ${profileDisplayName}`}</h2>
      <p className="muted">{roleLabel}</p>
      <p className="muted">View and update your account profile details.</p>

      <div className="card">
        <h3>Profile details</h3>
        {profileQuery.isLoading ? <p>Loading profile...</p> : null}
        {profileQuery.data ? (
          <p className="muted">
            Role: <b>{profileQuery.data.role}</b>
          </p>
        ) : null}

        <label>Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />

        <label>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61..." />

        <label>Timezone</label>
        <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Australia/Melbourne" />

        <label>Avatar URL</label>
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />

        <button className="primary-btn" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
          {updateMutation.isPending ? "Saving..." : "Update profile"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="card">
        <h3>My given reviews</h3>
        <p className="muted">Reviews you have posted for completed services.</p>
        {bookingsQuery.isLoading ? <p>Loading your reviews...</p> : null}
        {!bookingsQuery.isLoading && myReviews.length === 0 ? <p className="muted">No reviews posted yet.</p> : null}
        <ul className="list">
          {myReviews.map((review) => (
            <li key={review.id}>
              <span>
                <b>{review.trainerName}</b> · <StarDisplay value={review.rating} /> ({review.rating}/5)
                {review.comment ? ` - ${review.comment}` : " - No comment"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
