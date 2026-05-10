import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getBookings } from "../../services/bookings";
import { createReview, deleteReview, getTrainerReviews } from "../../services/reviews";
import { getTrainers } from "../../services/trainers";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme";

export function ClientReviewsScreen() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeBookingId, setActiveBookingId] = useState("");
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState("");

  const trainersQuery = useQuery({ queryKey: ["trainers"], queryFn: getTrainers });
  const bookingsQuery = useQuery({ queryKey: ["bookings"], queryFn: () => getBookings(token) });

  const completedBookings = useMemo(() => (bookingsQuery.data ?? []).filter((b) => b.status === "completed"), [bookingsQuery.data]);
  const completedTrainerIds = useMemo(
    () => Array.from(new Set(completedBookings.map((b) => b.trainer_id).filter((id): id is string => Boolean(id)))),
    [completedBookings],
  );
  const reviewsByCompletedTrainer = useQueries({
    queries: completedTrainerIds.map((trainerId) => ({
      queryKey: ["reviews", trainerId],
      queryFn: () => getTrainerReviews(trainerId),
    })),
  });

  const myReviewByBookingId = useMemo(() => {
    const map = new Map<string, { id: string; rating: number; comment: string | null }>();
    reviewsByCompletedTrainer.forEach((query) => {
      (query.data ?? []).forEach((review) => {
        if (review.client_id !== user?.id) return;
        map.set(review.booking_id, { id: review.id, rating: review.rating, comment: review.comment });
      });
    });
    return map;
  }, [reviewsByCompletedTrainer, user?.id]);

  const trainerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (trainersQuery.data ?? []).forEach((trainer) => map.set(trainer.id, trainer.profiles?.full_name ?? "Trainer"));
    return map;
  }, [trainersQuery.data]);

  const createReviewMutation = useMutation({
    mutationFn: (params: { bookingId: string; rating: number; comment?: string }) =>
      createReview(token, { bookingId: params.bookingId, rating: params.rating, comment: params.comment }),
    onSuccess: () => {
      setActiveBookingId("");
      setDraftComment("");
      setDraftRating(5);
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      completedTrainerIds.forEach((trainerId) => void queryClient.invalidateQueries({ queryKey: ["reviews", trainerId] }));
    },
    onError: (e) => Alert.alert("Review failed", (e as Error).message),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: string) => deleteReview(token, reviewId),
    onSuccess: () => {
      completedTrainerIds.forEach((trainerId) => void queryClient.invalidateQueries({ queryKey: ["reviews", trainerId] }));
    },
    onError: (e) => Alert.alert("Delete failed", (e as Error).message),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Reviews</Text>
      <FlatList
        data={completedBookings}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={bookingsQuery.isLoading ? <Text style={styles.subtle}>Loading completed services...</Text> : <Text style={styles.subtle}>No completed services yet.</Text>}
        renderItem={({ item }) => {
          const existing = myReviewByBookingId.get(item.id);
          const trainerName = item.trainer_id ? (trainerNameById.get(item.trainer_id) ?? "Trainer") : "Trainer";
          return (
            <View style={styles.card}>
              <Text style={styles.title}>
                {item.booking_date} {item.start_time.slice(0, 5)}-{item.end_time.slice(0, 5)}
              </Text>
              <Text style={styles.subtle}>{trainerName}</Text>
              {existing ? (
                <Text style={styles.subtle}>
                  Your review: {existing.rating}/5 {existing.comment ? `- ${existing.comment}` : ""}
                </Text>
              ) : null}
              <View style={styles.row}>
                {!existing ? (
                  <Pressable style={styles.button} onPress={() => setActiveBookingId((prev) => (prev === item.id ? "" : item.id))}>
                    <Text style={styles.buttonText}>{activeBookingId === item.id ? "Cancel" : "Review now"}</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.button} onPress={() => deleteReviewMutation.mutate(existing.id)} disabled={deleteReviewMutation.isPending}>
                    <Text style={styles.buttonText}>Delete review</Text>
                  </Pressable>
                )}
              </View>
              {activeBookingId === item.id && !existing ? (
                <View style={styles.form}>
                  <Text style={styles.subtle}>Rating (1-5)</Text>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable key={value} style={[styles.ratingPill, draftRating === value ? styles.ratingPillActive : null]} onPress={() => setDraftRating(value)}>
                        <Text style={styles.ratingText}>{value}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={styles.input}
                    value={draftComment}
                    onChangeText={setDraftComment}
                    placeholder="Share your experience"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Pressable
                    style={styles.button}
                    onPress={() => createReviewMutation.mutate({ bookingId: item.id, rating: draftRating, comment: draftComment.trim() || undefined })}
                    disabled={createReviewMutation.isPending}
                  >
                    <Text style={styles.buttonText}>{createReviewMutation.isPending ? "Submitting..." : "Submit review"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 14 },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtle: { color: colors.textSecondary },
  card: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10 },
  title: { color: colors.textPrimary, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  button: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", backgroundColor: colors.primary },
  buttonText: { color: colors.textPrimary, fontWeight: "700" },
  form: { marginTop: 8, gap: 8 },
  input: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 8, color: colors.textPrimary, paddingHorizontal: 10, paddingVertical: 8 },
  ratingRow: { flexDirection: "row", gap: 6 },
  ratingPill: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  ratingPillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoftStrong },
  ratingText: { color: colors.textBody, fontWeight: "700" },
});
