import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { getBookings } from "../../services/bookings";
import { getMyTrainerProfile } from "../../services/trainers";
import { useAuth } from "../../state/auth-context";

export function TrainerOverviewScreen() {
  const { token } = useAuth();
  const trainerQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
  });
  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });

  const bookings = bookingsQuery.data ?? [];
  const pending = bookings.filter((item) => item.status === "pending").length;
  const confirmed = bookings.filter((item) => item.status === "confirmed").length;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Trainer Overview</Text>
      <Text style={styles.subtle}>
        {trainerQuery.data?.profiles?.full_name ?? "Trainer"} · {trainerQuery.data?.verified ? "Verified" : "Not verified"}
      </Text>
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Pending requests</Text>
          <Text style={styles.kpiValue}>{pending}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Confirmed sessions</Text>
          <Text style={styles.kpiValue}>{confirmed}</Text>
        </View>
      </View>
      <Text style={styles.section}>Upcoming bookings</Text>
      <FlatList
        data={bookings.slice(0, 8)}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={bookingsQuery.isLoading ? <Text style={styles.subtle}>Loading bookings...</Text> : <Text style={styles.subtle}>No bookings yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.booking_date}</Text>
            <Text style={styles.subtle}>
              {item.start_time} - {item.end_time}
            </Text>
            <Text style={styles.badge}>{item.status}</Text>
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
  kpiRow: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 10 },
  kpiCard: { flex: 1, backgroundColor: "#0f172a", borderColor: "#1e293b", borderWidth: 1, borderRadius: 10, padding: 10 },
  kpiLabel: { color: "#94a3b8", fontSize: 12, textTransform: "uppercase" },
  kpiValue: { color: "#fff", fontSize: 26, fontWeight: "700" },
  section: { color: "#cbd5e1", fontWeight: "700", marginBottom: 8, marginTop: 6 },
  card: { backgroundColor: "#0f172a", borderColor: "#1e293b", borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  title: { color: "#fff", fontWeight: "700" },
  badge: { color: "#93c5fd", marginTop: 5, textTransform: "uppercase" },
});
