import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getBookings } from "../services/bookings";
import { createReview, deleteReview, getTrainerReviews } from "../services/reviews";
import { getTrainers } from "../services/trainers";
import { useAuth } from "../state/auth-context";

export function ReviewsPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
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

  const createReviewMutation = useMutation({
    mutationFn: () =>
      createReview(token, {
        bookingId: selectedBookingId,
        rating,
        comment: comment || undefined,
      }),
    onSuccess: () => {
      setError("");
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["reviews", selectedTrainerId] });
      void queryClient.invalidateQueries({ queryKey: ["trainers"] });
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
    },
    onError: (e) => {
      setError((e as Error).message);
    },
  });

  return (
    <section>
      <h2>My reviews</h2>

      <div className="card">
        <h3>Leave a review</h3>
        <p className="muted">You can review only completed bookings.</p>

        <label>Completed booking</label>
        <select value={selectedBookingId} onChange={(e) => setSelectedBookingId(e.target.value)}>
          <option value="">Select completed booking</option>
          {completedBookings.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.booking_date} {booking.start_time}-{booking.end_time} ({booking.id})
            </option>
          ))}
        </select>

        <label>Rating</label>
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          <option value={5}>5</option>
          <option value={4}>4</option>
          <option value={3}>3</option>
          <option value={2}>2</option>
          <option value={1}>1</option>
        </select>

        <label>Comment</label>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience"
        />

        <button
          className="primary-btn"
          disabled={!selectedBookingId || createReviewMutation.isPending}
          onClick={() => createReviewMutation.mutate()}
        >
          {createReviewMutation.isPending ? "Submitting..." : "Submit review"}
        </button>

        {error ? <p className="error">{error}</p> : null}
      </div>

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
