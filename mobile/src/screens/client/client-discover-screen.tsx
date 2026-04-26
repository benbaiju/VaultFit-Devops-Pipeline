import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native";
import { getTrainers } from "../../services/trainers";

type Props = {
  navigation: { navigate: (name: string, params?: Record<string, string>) => void };
};

export function ClientDiscoverScreen({ navigation }: Props) {
  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Discover Trainers</Text>
      <Text style={styles.subtle}>Browse verified trainers and nutritionists.</Text>
      <FlatList
        data={trainersQuery.data ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={trainersQuery.isLoading ? <Text style={styles.subtle}>Loading trainers...</Text> : <Text style={styles.subtle}>No trainers found.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate("TrainerProfile", { trainerId: item.id })}>
            <Text style={styles.title}>{item.profiles?.full_name ?? "Trainer"}</Text>
            <Text style={styles.subtle}>{item.specialty ?? "General training"}</Text>
            <Text style={styles.badge}>{item.verified ? "Verified" : "Not verified"}</Text>
            <Text style={styles.link}>View profile and book</Text>
          </Pressable>
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
  badge: { color: "#93c5fd", marginTop: 5 },
  link: { color: "#a5b4fc", marginTop: 6, fontWeight: "600" },
});
