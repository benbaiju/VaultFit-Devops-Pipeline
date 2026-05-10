import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getBookings, updateBookingStatus } from "../../services/bookings";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme";

export function TrainerBookingsScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });
  const statusMutation = useMutation({
    mutationFn: (input: { bookingId: string; status: "confirmed" | "completed" | "cancelled" }) =>
      updateBookingStatus(token, input.bookingId, input.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => Alert.alert("Status update failed", (e as Error).message),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Session Requests</Text>
      <Text style={styles.subtle}>Review and update booking statuses.</Text>
      <FlatList
        data={bookingsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={bookingsQuery.isLoading ? <Text style={styles.subtle}>Loading bookings...</Text> : <Text style={styles.subtle}>No bookings found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.booking_date}</Text>
            <Text style={styles.subtle}>
              {item.start_time} - {item.end_time}
            </Text>
            <Text style={styles.badge}>{item.status}</Text>
            <View style={styles.row}>
              <Pressable style={styles.button} onPress={() => statusMutation.mutate({ bookingId: item.id, status: "confirmed" })}>
                <Text style={styles.buttonText}>Confirm</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={() => statusMutation.mutate({ bookingId: item.id, status: "completed" })}>
                <Text style={styles.buttonText}>Complete</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.cancelButton]} onPress={() => statusMutation.mutate({ bookingId: item.id, status: "cancelled" })}>
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 14 },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtle: { color: colors.textSecondary },
  card: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  title: { color: colors.textPrimary, fontWeight: "700" },
  badge: { color: colors.primaryMuted, marginTop: 5, textTransform: "uppercase" },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  button: { backgroundColor: colors.blueAction, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  cancelButton: { backgroundColor: colors.dangerDark },
  buttonText: { color: colors.textPrimary, fontWeight: "700" },
});
