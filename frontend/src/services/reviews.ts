import { apiRequest } from "../lib/api-client";
import type { Review } from "../types/api";

type CreateReviewInput = {
  bookingId: string;
  rating: number;
  comment?: string;
};

export async function createReview(token: string, input: CreateReviewInput): Promise<Review> {
  return apiRequest<Review>(
    `/bookings/${input.bookingId}/review`,
    {
      method: "POST",
      body: JSON.stringify({
        rating: input.rating,
        comment: input.comment,
      }),
    },
    token,
  );
}

export async function getTrainerReviews(trainerId: string): Promise<Review[]> {
  return apiRequest<Review[]>(`/trainers/${trainerId}/reviews`);
}

export async function deleteReview(token: string, reviewId: string): Promise<void> {
  await apiRequest(`/reviews/${reviewId}`, { method: "DELETE" }, token);
}
