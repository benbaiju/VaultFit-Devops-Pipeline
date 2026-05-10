import { useQuery } from "@tanstack/react-query";
import { FlatList, Text, View } from "react-native";
import { getBookings } from "../../services/bookings";
import { getMyTrainerProfile } from "../../services/trainers";
import { useAuth } from "../../state/auth-context";
import { Font } from "../../theme/fonts";
import { ScreenGradient, VerifiedBadge, vf, statusTone } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
      <FlatList
        data={bookings.slice(0, 12)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={vf.listPad}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <Text style={vf.h2}>Dashboard</Text>
            <Text style={vf.lead}>{trainerQuery.data?.profiles?.full_name ?? "Trainer"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <VerifiedBadge verified={trainerQuery.data?.verified ?? false} />
            </View>
            <View style={vf.kpiRow}>
              <View style={vf.kpiCard}>
                <Text style={vf.kpiLabel}>Pending</Text>
                <Text style={vf.kpiValue}>{pending}</Text>
              </View>
              <View style={vf.kpiCard}>
                <Text style={vf.kpiLabel}>Confirmed</Text>
                <Text style={vf.kpiValue}>{confirmed}</Text>
              </View>
            </View>
            <Text style={vf.h3}>Upcoming bookings</Text>
          </View>
        }
        ListEmptyComponent={
          bookingsQuery.isLoading ? (
            <Text style={vf.muted}>Loading bookings...</Text>
          ) : (
            <Text style={vf.muted}>No bookings yet.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={vf.card}>
            <Text style={vf.cardTitle}>{item.booking_date}</Text>
            <Text style={vf.body}>
              {item.start_time} – {item.end_time}
            </Text>
            <Text
              style={[vf.muted, statusTone(item.status.toUpperCase()), { textTransform: "uppercase", marginTop: 6, fontFamily: Font.outfitSemiBold }]}
            >
              {item.status}
            </Text>
          </View>
        )}
      />
    </ScreenGradient>
  );
}
