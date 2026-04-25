import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getBookings } from "../services/bookings";
import { createReview, deleteReview, getTrainerReviews } from "../services/reviews";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

export function ReviewsPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [activeBookingId, setActiveBookingId] = useState("");
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState("");
  const [error, setError] = useState("");

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const reviewsQuery = useQuery({
    queryKey: ["reviews", selectedTrainerId],
    queryFn: () => getTrainerReviews(selectedTrainerId),
    enabled: Boolean(selectedTrainerId),
  });

  const completedBookings = useMemo(
    () => (bookingsQuery.data ?? []).filter((b) => b.status === "completed"),
    [bookingsQuery.data],
  );
  const completedTrainerIds = useMemo(
    () =>
      Array.from(
        new Set(completedBookings.map((b) => b.trainer_id).filter((id): id is string => Boolean(id))),
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
  const myReviewByBookingId = useMemo(() => {
    const map = new Map<string, { id: string; rating: number; comment: string | null; createdAt: string }>();
    reviewsByCompletedTrainer.forEach((query) => {
      (query.data ?? []).forEach((review) => {
        if (review.client_id !== user?.id) return;
        map.set(review.booking_id, {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.created_at,
        });
      });
    });
    return map;
  }, [reviewsByCompletedTrainer, user?.id]);

  const createReviewMutation = useMutation({
    mutationFn: (params: { bookingId: string; rating: number; comment?: string }) =>
      createReview(token, {
        bookingId: params.bookingId,
        rating: params.rating,
        comment: params.comment,
      }),
    onSuccess: () => {
      setError("");
      setDraftComment("");
      setDraftRating(5);
      setActiveBookingId("");
      void queryClient.invalidateQueries({ queryKey: ["reviews", selectedTrainerId] });
      void queryClient.invalidateQueries({ queryKey: ["trainers"] });
      completedTrainerIds.forEach((trainerId) => {
        void queryClient.invalidateQueries({ queryKey: ["reviews", trainerId] });
      });
    },
    onError: (e) => {
      setError((e as Error).message);
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: string) => deleteReview(token, reviewId),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["reviews", selectedTrainerId] });
      void queryClient.invalidateQueries({ queryKey: ["trainers"] });
      completedTrainerIds.forEach((trainerId) => {
        void queryClient.invalidateQueries({ queryKey: ["reviews", trainerId] });
      });
    },
    onError: (e) => {
      setError((e as Error).message);
    },
  });

  return (
    <section>
      <h2>My reviews</h2>

      <div className="card">
        <h3>Completed services</h3>
        <p className="muted">Each completed booking can be reviewed once.</p>
        {bookingsQuery.isLoading ? <p>Loading completed services...</p> : null}
        {!bookingsQuery.isLoading && completedBookings.length === 0 ? (
          <p className="muted">No completed services yet.</p>
        ) : null}
        <ul className="list">
          {completedBookings.map((booking) => {
            const existingReview = myReviewByBookingId.get(booking.id);
            const trainerLabel = booking.trainer_id
              ? (trainerNameById.get(booking.trainer_id) ?? `Trainer ${booking.trainer_id.slice(0, 8)}`)
              : "Trainer";
            return (
              <li key={booking.id}>
                <span>
                  <b>{booking.booking_date}</b> {booking.start_time}-{booking.end_time} · {trainerLabel}
                  {existingReview ? (
                    <span className="muted">
                      {" "}
                      · Your review: {existingReview.rating}/5
                      {existingReview.comment ? ` - ${existingReview.comment}` : ""}
                    </span>
                  ) : (
                    <span className="muted"> · Not reviewed yet</span>
                  )}
                </span>
                <button
                  className="secondary-btn"
                  onClick={() => {
                    setActiveBookingId((prev) => (prev === booking.id ? "" : booking.id));
                    setDraftRating(5);
                    setDraftComment("");
                  }}
                >
                  {existingReview ? "Reviewed" : activeBookingId === booking.id ? "Cancel" : "Review now"}
                </button>
                {existingReview ? (
                  <button
                    className="secondary-btn"
                    disabled={deleteReviewMutation.isPending}
                    onClick={() => deleteReviewMutation.mutate(existingReview.id)}
                  >
                    Delete review
                  </button>
                ) : null}
                {activeBookingId === booking.id && !existingReview ? (
                  <div style={{ width: "100%", marginTop: "0.5rem" }}>
                    <label>Rating</label>
                    <select value={draftRating} onChange={(e) => setDraftRating(Number(e.target.value))}>
                      <option value={5}>5</option>
                      <option value={4}>4</option>
                      <option value={3}>3</option>
                      <option value={2}>2</option>
                      <option value={1}>1</option>
                    </select>
                    <label>Comment</label>
                    <input
                      value={draftComment}
                      onChange={(e) => setDraftComment(e.target.value)}
                      placeholder="Share your experience"
                    />
                    <button
                      className="primary-btn"
                      disabled={createReviewMutation.isPending}
                      onClick={() =>
                        createReviewMutation.mutate({
                          bookingId: booking.id,
                          rating: draftRating,
                          comment: draftComment.trim() || undefined,
                        })
                      }
                    >
                      {createReviewMutation.isPending ? "Submitting..." : "Submit review"}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h3>Browse Trainer Reviews</h3>
        <label>Trainer</label>
        <select value={selectedTrainerId} onChange={(e) => setSelectedTrainerId(e.target.value)}>
          <option value="">Select trainer</option>
          {(trainersQuery.data ?? []).map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.profiles?.full_name ?? trainer.id}
            </option>
          ))}
        </select>

        {reviewsQuery.isLoading ? <p>Loading reviews...</p> : null}
        <ul className="list">
          {(reviewsQuery.data ?? []).map((review) => (
            <li key={review.id}>
              <span>
                <b>{review.rating}/5</b> - {review.comment ?? "No comment"}
              </span>
              {review.client_id === user?.id ? (
                <button
                  className="secondary-btn"
                  disabled={deleteReviewMutation.isPending}
                  onClick={() => deleteReviewMutation.mutate(review.id)}
                >
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
