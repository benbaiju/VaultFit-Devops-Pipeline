import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getBookings } from "../../services/bookings";
import { createReview, deleteReview, getTrainerReviews } from "../../services/reviews";
import { getTrainers } from "../../services/trainers";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { Font } from "../../theme/fonts";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
      <FlatList
        data={completedBookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={vf.listPad}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <Text style={vf.h2}>My reviews</Text>
            <Text style={vf.lead}>Reflect on completed bookings — mirrors the web portal.</Text>
          </View>
        }
        ListEmptyComponent={
          bookingsQuery.isLoading ? (
            <Text style={vf.muted}>Loading completed services...</Text>
          ) : (
            <Text style={vf.muted}>No completed services yet.</Text>
          )
        }
        renderItem={({ item }) => {
          const existing = myReviewByBookingId.get(item.id);
          const trainerName = item.trainer_id ? (trainerNameById.get(item.trainer_id) ?? "Trainer") : "Trainer";
          return (
            <View style={vf.card}>
              <Text style={vf.cardTitle}>
                {item.booking_date} {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}
              </Text>
              <Text style={vf.body}>{trainerName}</Text>
              {existing ? (
                <Text style={[vf.muted, { marginTop: 8 }]}>
                  Your review: {existing.rating}/5 {existing.comment ? `— ${existing.comment}` : ""}
                </Text>
              ) : null}
              <View style={styles.row}>
                {!existing ? (
                  <Pressable style={[vf.primaryBtn, { marginTop: 8 }]} onPress={() => setActiveBookingId((prev) => (prev === item.id ? "" : item.id))}>
                    <Text style={vf.btnLabel}>{activeBookingId === item.id ? "Cancel" : "Review now"}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[vf.secondaryBtn, { marginTop: 8 }]}
                    onPress={() => deleteReviewMutation.mutate(existing.id)}
                    disabled={deleteReviewMutation.isPending}
                  >
                    <Text style={vf.btnLabel}>Delete review</Text>
                  </Pressable>
                )}
              </View>
              {activeBookingId === item.id && !existing ? (
                <View style={styles.form}>
                  <Text style={vf.label}>Rating (1–5)</Text>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable key={value} style={[styles.ratingPill, draftRating === value ? styles.ratingPillActive : null]} onPress={() => setDraftRating(value)}>
                        <Text style={[styles.ratingText, { fontFamily: Font.outfitSemiBold }]}>{value}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={[vf.input, { marginBottom: 0 }]}
                    value={draftComment}
                    onChangeText={setDraftComment}
                    placeholder="Share your experience"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Pressable
                    style={[vf.primaryBtn, { marginTop: 4 }]}
                    onPress={() => createReviewMutation.mutate({ bookingId: item.id, rating: draftRating, comment: draftComment.trim() || undefined })}
                    disabled={createReviewMutation.isPending}
                  >
                    <Text style={vf.btnLabel}>{createReviewMutation.isPending ? "Submitting..." : "Submit review"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  form: { marginTop: 12, gap: 8 },
  ratingRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  ratingPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.15)" },
  ratingPillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoftStrong },
  ratingText: { color: colors.textBody, fontSize: 15 },
});
