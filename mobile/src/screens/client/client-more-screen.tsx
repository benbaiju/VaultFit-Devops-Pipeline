import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme";

type Props = {
  navigation: { navigate: (name: string) => void };
};

export function ClientMoreScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>More</Text>
      <Text style={styles.subtle}>Extra tools and account actions.</Text>

      <Pressable style={styles.card} onPress={() => navigation.navigate("ClientReviews")}>
        <Text style={styles.title}>Reviews</Text>
        <Text style={styles.subtle}>See and manage your service reviews.</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => navigation.navigate("ClientNotifications")}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtle}>View and mark notifications as read.</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => navigation.navigate("ClientSupport")}>
        <Text style={styles.title}>Support</Text>
        <Text style={styles.subtle}>Create tickets and follow responses.</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 14 },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtle: { color: colors.textSecondary, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 10 },
  title: { color: colors.textPrimary, fontWeight: "700", marginBottom: 4 },
});
