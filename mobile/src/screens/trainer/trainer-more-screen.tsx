import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme";

type Props = {
  navigation: { navigate: (name: string) => void };
};

export function TrainerMoreScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>More</Text>
      <Text style={styles.subtle}>Extra trainer tools.</Text>

      <Pressable style={styles.card} onPress={() => navigation.navigate("TrainerServices")}>
        <Text style={styles.title}>Services</Text>
        <Text style={styles.subtle}>Create and manage your services.</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => navigation.navigate("TrainerPlans")}>
        <Text style={styles.title}>Plans</Text>
        <Text style={styles.subtle}>Create and track client plans.</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => navigation.navigate("TrainerNotifications")}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtle}>View and mark notifications as read.</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => navigation.navigate("TrainerSupport")}>
        <Text style={styles.title}>Support</Text>
        <Text style={styles.subtle}>Open and follow support tickets.</Text>
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
