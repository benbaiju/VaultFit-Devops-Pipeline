import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native";
import { getTrainers } from "../../services/trainers";
import { colors, Font } from "../../theme";

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
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 14 },
  heading: { color: colors.textPrimary, fontSize: 24, fontFamily: Font.outfitBold, marginBottom: 6, letterSpacing: -0.4 },
  subtle: { color: colors.textSecondary, fontFamily: Font.outfitRegular },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  title: { color: colors.textPrimary, fontFamily: Font.outfitSemiBold },
  badge: { color: colors.primaryMuted, marginTop: 5, fontFamily: Font.outfitMedium },
  link: { color: colors.primaryMuted, marginTop: 6, fontFamily: Font.outfitSemiBold },
});
