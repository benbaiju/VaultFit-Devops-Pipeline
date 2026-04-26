import { Pressable, StyleSheet, Text, View } from "react-native";

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
  container: { flex: 1, backgroundColor: "#020817", padding: 14 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtle: { color: "#94a3b8", marginBottom: 8 },
  card: { backgroundColor: "#0f172a", borderColor: "#1e293b", borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 10 },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
});
