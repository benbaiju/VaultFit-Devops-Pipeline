import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { createBooking, getOpenSlots } from "../../services/bookings";
import { getTrainerReviews } from "../../services/reviews";
import { getServices } from "../../services/services";
import { getTrainerById } from "../../services/trainers";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { ScreenGradient, VerifiedBadge, vf } from "../../ui/vaultfit-ui";

function toIsoDate(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

export function ClientTrainerProfileScreen() {
  const route = useRoute<any>();
  const trainerId = route.params?.trainerId as string;
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedSlotKey, setSelectedSlotKey] = useState("");

  const trainerQuery = useQuery({
    queryKey: ["trainer", trainerId],
    queryFn: () => getTrainerById(trainerId),
  });
  const servicesQuery = useQuery({
    queryKey: ["services", trainerId],
    queryFn: () => getServices(trainerId),
  });
  const reviewsQuery = useQuery({
    queryKey: ["reviews", trainerId],
    queryFn: () => getTrainerReviews(trainerId),
  });
  const openSlotsQuery = useQuery({
    queryKey: ["open-slots", trainerId, selectedServiceId],
    queryFn: () => getOpenSlots(trainerId, selectedServiceId, toIsoDate(0), toIsoDate(7)),
    enabled: Boolean(selectedServiceId),
  });

  const selectedService = useMemo(
    () => (servicesQuery.data ?? []).find((item) => item.id === selectedServiceId) ?? null,
    [servicesQuery.data, selectedServiceId],
  );
  const selectedSlot = useMemo(() => {
    const slots = openSlotsQuery.data ?? [];
    return slots.find((item) => `${item.date}|${item.startTime}|${item.endTime}` === selectedSlotKey) ?? null;
  }, [openSlotsQuery.data, selectedSlotKey]);

  const createMutation = useMutation({
    mutationFn: () =>
      createBooking(token, {
        trainerId,
        serviceId: selectedServiceId,
        bookingDate: selectedSlot?.date ?? toIsoDate(0),
        startTime: selectedSlot?.startTime ?? "10:00:00",
        endTime: selectedSlot?.endTime ?? "11:00:00",
        notes: "Booked from mobile trainer profile",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      Alert.alert("Booked", "Session created successfully.");
      setSelectedSlotKey("");
    },
    onError: (e) => Alert.alert("Booking failed", (e as Error).message),
  });

  if (trainerQuery.isLoading) {
    return (
      <ScreenGradient>
        <View style={styles.shell}>
          <Text style={vf.muted}>Loading trainer profile...</Text>
        </View>
      </ScreenGradient>
    );
  }

  if (!trainerQuery.data) {
    return (
      <ScreenGradient>
        <View style={styles.shell}>
          <Text style={vf.muted}>Trainer not found.</Text>
        </View>
      </ScreenGradient>
    );
  }

  const trainer = trainerQuery.data;
  const reviews = reviewsQuery.data ?? [];
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

  return (
    <ScreenGradient>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={vf.listPad}
        data={openSlotsQuery.data ?? []}
        keyExtractor={(item) => `${item.date}|${item.startTime}|${item.endTime}`}
        ListHeaderComponent={
          <View>
            <Text style={vf.h2}>{trainer.profiles?.full_name ?? "Trainer"}</Text>
            <Text style={vf.lead}>{trainer.specialty ?? "General training"}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <VerifiedBadge verified={trainer.verified} />
              <Text style={vf.muted}>${trainer.hourly_rate}/hr</Text>
            </View>
            <Text style={vf.body}>{trainer.bio ?? "This trainer has not added a bio yet."}</Text>

            <View style={[vf.card, { marginTop: 4 }]}>
              <Text style={vf.h3}>Client reviews</Text>
              <Text style={[vf.muted, { marginBottom: 8 }]}>
                {reviews.length ? `${averageRating.toFixed(1)} / 5 (${reviews.length} reviews)` : "No reviews yet"}
              </Text>
              {reviews.slice(0, 5).map((review) => (
                <View key={review.id} style={[styles.reviewItem]}>
                  <Text style={styles.reviewTitle}>{review.rating}/5</Text>
                  <Text style={vf.muted}>{review.comment ?? "No comment"}</Text>
                </View>
              ))}
            </View>

            <View style={vf.card}>
              <Text style={vf.h3}>Select service</Text>
              {(servicesQuery.data ?? []).filter((service) => service.is_active).map((service) => (
                <Pressable
                  key={service.id}
                  style={[styles.serviceChip, selectedServiceId === service.id ? styles.serviceChipActive : null]}
                  onPress={() => {
                    setSelectedServiceId(service.id);
                    setSelectedSlotKey("");
                  }}
                >
                  <Text style={styles.serviceText}>
                    {service.title} · {service.duration_minutes}m · ${service.price}
                  </Text>
                </Pressable>
              ))}
              {selectedServiceId ? <Text style={[vf.muted, { marginTop: 8 }]}>Choose a slot below to complete booking.</Text> : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          selectedServiceId ? <Text style={vf.muted}>{openSlotsQuery.isLoading ? "Loading open slots..." : "No open slots in next 7 days."}</Text> : null
        }
        renderItem={({ item }) => {
          const slotKey = `${item.date}|${item.startTime}|${item.endTime}`;
          const selected = selectedSlotKey === slotKey;
          return (
            <Pressable style={[styles.slot, selected ? styles.slotActive : null]} onPress={() => setSelectedSlotKey(slotKey)}>
              <Text style={styles.slotText}>
                {item.date} · {item.startTime.slice(0, 5)}-{item.endTime.slice(0, 5)}
              </Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          selectedService && selectedSlot ? (
            <Pressable style={vf.primaryBtn} onPress={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Text style={vf.btnLabel}>{createMutation.isPending ? "Booking..." : "Book this slot"}</Text>
            </Pressable>
          ) : null
        }
      />
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, justifyContent: "center" },
  reviewItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    backgroundColor: "rgba(0, 0, 0, 0.22)",
  },
  reviewTitle: { color: colors.textBody, fontWeight: "700" },
  serviceChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  serviceChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  serviceText: { color: colors.textBody },
  slot: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 8 },
  slotActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  slotText: { color: colors.textSection },
});
