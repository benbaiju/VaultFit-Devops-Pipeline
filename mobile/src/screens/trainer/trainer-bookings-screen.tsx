import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getBookings, updateBookingStatus } from "../../services/bookings";
import { useAuth } from "../../state/auth-context";
import { Font } from "../../theme/fonts";
import { ScreenGradient, vf, statusTone } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
      <FlatList
        data={bookingsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={vf.listPad}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <Text style={vf.h2}>Session requests</Text>
            <Text style={vf.lead}>Confirm, complete, or cancel like the web trainer portal.</Text>
          </View>
        }
        ListEmptyComponent={
          bookingsQuery.isLoading ? (
            <Text style={vf.muted}>Loading bookings...</Text>
          ) : (
            <Text style={vf.muted}>No bookings found.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={vf.card}>
            <Text style={vf.cardTitle}>{item.booking_date}</Text>
            <Text style={vf.body}>
              {item.start_time} – {item.end_time}
            </Text>
            <Text style={[vf.muted, statusTone(item.status.toUpperCase()), { marginTop: 8, textTransform: "uppercase", fontFamily: Font.outfitSemiBold }]}>
              {item.status}
            </Text>
            <View style={row.row}>
              <Pressable style={[vf.secondaryBtn, { flex: 1, marginBottom: 0 }]} onPress={() => statusMutation.mutate({ bookingId: item.id, status: "confirmed" })}>
                <Text style={vf.btnLabel}>Confirm</Text>
              </Pressable>
              <Pressable style={[vf.primaryBtn, { flex: 1, marginBottom: 0 }]} onPress={() => statusMutation.mutate({ bookingId: item.id, status: "completed" })}>
                <Text style={vf.btnLabel}>Complete</Text>
              </Pressable>
              <Pressable
                style={[row.dangerBtn, { flex: 1 }]}
                onPress={() => statusMutation.mutate({ bookingId: item.id, status: "cancelled" })}
              >
                <Text style={vf.btnLabel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </ScreenGradient>
  );
}

const row = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 14 },
  dangerBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#7f1d1d",
  },
});
