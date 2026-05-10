import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { getBookings, payBooking } from "../../services/bookings";
import { useAuth } from "../../state/auth-context";
import { Font } from "../../theme/fonts";
import { ScreenGradient, vf, statusTone } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
      <FlatList
        data={bookingsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={vf.listPad}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <Text style={vf.h2}>My bookings</Text>
            <Text style={vf.lead}>Track sessions and settle payments.</Text>
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
              style={[vf.muted, statusTone(String(item.status)), { textTransform: "uppercase", marginTop: 8, fontFamily: Font.outfitSemiBold }]}
            >
              {item.status}
            </Text>
            {item.status === "pending" ? (
              <Pressable style={vf.primaryBtn} onPress={() => payMutation.mutate(item.id)}>
                <Text style={vf.btnLabel}>Pay now</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </ScreenGradient>
  );
}
