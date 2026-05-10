import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { createBooking, getOpenSlots } from "../../services/bookings";
import { getTrainerReviews } from "../../services/reviews";
import { getServices } from "../../services/services";
import { getTrainerById } from "../../services/trainers";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme";

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
      <View style={styles.container}>
        <Text style={styles.subtle}>Loading trainer profile...</Text>
      </View>
    );
  }

  if (!trainerQuery.data) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtle}>Trainer not found.</Text>
      </View>
    );
  }

  const trainer = trainerQuery.data;
  const reviews = reviewsQuery.data ?? [];
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={openSlotsQuery.data ?? []}
        keyExtractor={(item) => `${item.date}|${item.startTime}|${item.endTime}`}
        ListHeaderComponent={
          <View>
            <Text style={styles.heading}>{trainer.profiles?.full_name ?? "Trainer"}</Text>
            <Text style={styles.subtle}>{trainer.specialty ?? "General training"}</Text>
            <Text style={styles.subtle}>{trainer.verified ? "Verified" : "Unverified"} · ${trainer.hourly_rate}/hr</Text>
            <Text style={styles.bio}>{trainer.bio ?? "This trainer has not added a bio yet."}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client reviews</Text>
              <Text style={styles.subtle}>
                {reviews.length ? `${averageRating.toFixed(1)} / 5 (${reviews.length} reviews)` : "No reviews yet"}
              </Text>
              {reviews.slice(0, 5).map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <Text style={styles.reviewTitle}>{review.rating}/5</Text>
                  <Text style={styles.subtle}>{review.comment ?? "No comment"}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select service</Text>
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
              {selectedServiceId ? <Text style={styles.subtle}>Choose a slot below to complete booking.</Text> : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          selectedServiceId ? <Text style={styles.subtle}>{openSlotsQuery.isLoading ? "Loading open slots..." : "No open slots in next 7 days."}</Text> : null
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
            <Pressable style={styles.bookButton} onPress={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Text style={styles.bookButtonText}>{createMutation.isPending ? "Booking..." : "Book this slot"}</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 14 },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
  subtle: { color: colors.textSecondary },
  bio: { color: colors.textSection, marginTop: 8, marginBottom: 8 },
  section: { marginTop: 12, marginBottom: 6 },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  reviewItem: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 8, marginTop: 6, backgroundColor: colors.surface },
  reviewTitle: { color: colors.textBody, fontWeight: "700" },
  serviceChip: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 8, padding: 8, marginBottom: 6 },
  serviceChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  serviceText: { color: colors.textBody },
  slot: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 8, padding: 10, marginTop: 8 },
  slotActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  slotText: { color: colors.textSection },
  bookButton: { marginTop: 12, marginBottom: 24, borderRadius: 8, paddingVertical: 10, alignItems: "center", backgroundColor: colors.primary },
  bookButtonText: { color: colors.textPrimary, fontWeight: "700" },
});
