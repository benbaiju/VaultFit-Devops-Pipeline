import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getBookings, payBooking } from "../../services/bookings";
import { useAuth } from "../../state/auth-context";

export function ClientBookingsScreen() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });
  const payMutation = useMutation({
    mutationFn: (bookingId: string) => payBooking(token, bookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      Alert.alert("Payment complete", "Booking payment marked as paid.");
    },
    onError: (e) => Alert.alert("Payment failed", (e as Error).message),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Bookings</Text>
      <Text style={styles.subtle}>Track and pay for your upcoming services.</Text>
      <FlatList
        data={bookingsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={bookingsQuery.isLoading ? <Text style={styles.subtle}>Loading bookings...</Text> : <Text style={styles.subtle}>No bookings yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.booking_date}</Text>
            <Text style={styles.subtle}>
              {item.start_time} - {item.end_time}
            </Text>
            <Text style={styles.badge}>{item.status}</Text>
            {item.status === "pending" ? (
              <Pressable style={styles.button} onPress={() => payMutation.mutate(item.id)}>
                <Text style={styles.buttonText}>Pay now</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", padding: 14 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtle: { color: "#94a3b8" },
  card: { backgroundColor: "#0f172a", borderColor: "#1e293b", borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 10 },
  title: { color: "#fff", fontWeight: "700" },
  badge: { color: "#93c5fd", marginTop: 5, textTransform: "uppercase" },
  button: { marginTop: 8, borderRadius: 8, paddingVertical: 8, alignItems: "center", backgroundColor: "#4f46e5" },
  buttonText: { color: "#fff", fontWeight: "700" },
});
