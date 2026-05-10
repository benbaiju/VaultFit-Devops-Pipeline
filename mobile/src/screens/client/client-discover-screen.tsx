import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, SectionList, Text, TextInput, View } from "react-native";
import type { Trainer } from "../../types/api";
import { getTrainers } from "../../services/trainers";
import { ScreenGradient, VerifiedBadge, vf } from "../../ui/vaultfit-ui";
import { colors } from "../../theme/colors";

type Props = {
  navigation: { navigate: (name: string, params?: Record<string, string>) => void };
};

function isNutritionSpecialty(value: string | null | undefined): boolean {
  const text = (value ?? "").toLowerCase();
  return text.includes("nutri") || text.includes("diet") || text.includes("meal");
}

export function ClientDiscoverScreen({ navigation }: Props) {
  const [search, setSearch] = useState("");
  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const { trainerRows, nutritionistRows } = useMemo(() => {
    const professionals = trainersQuery.data ?? [];
    const query = search.trim().toLowerCase();
    let filtered =
      query.length === 0
        ? professionals
        : professionals.filter((trainer) => {
            const name = trainer.profiles?.full_name ?? "";
            const specialty = trainer.specialty ?? "";
            const bio = trainer.bio ?? "";
            return [name, specialty, bio].some((f) => f.toLowerCase().includes(query));
          });
    const nutritionists = filtered.filter(
      (t) => t.profiles?.role === "nutritionist" || isNutritionSpecialty(t.specialty),
    );
    const trainerOnly = filtered.filter((t) => !nutritionists.some((n) => n.id === t.id));
    return { trainerRows: trainerOnly, nutritionistRows: nutritionists };
  }, [trainersQuery.data, search]);

  const sections = [
    { title: "Trainers", data: trainerRows },
    { title: "Nutritionists", data: nutritionistRows },
  ];

  const renderTrainer = ({ item }: { item: Trainer }) => (
    <Pressable
      style={({ pressed }) => [vf.cardTouchable, pressed && { opacity: 0.94 }]}
      onPress={() => navigation.navigate("TrainerProfile", { trainerId: item.id })}
    >
      <View style={vf.trainerCardTop}>
        <Text style={vf.cardTitle}>{item.profiles?.full_name ?? "Unnamed Trainer"}</Text>
        <VerifiedBadge verified={item.verified ?? false} />
      </View>
      <Text style={vf.muted}>Specialty: {item.specialty ?? "general"}</Text>
      <Text style={vf.muted}>Rate: ${item.hourly_rate}/hour</Text>
      <Text style={[vf.body, { marginTop: 8 }]} numberOfLines={4}>
        {item.bio ?? "No bio yet."}
      </Text>
      <Text style={vf.footerHint}>Click to view full profile</Text>
    </Pressable>
  );

  return (
    <ScreenGradient>
      <SectionList<Trainer>
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderTrainer}
        renderSectionHeader={({ section }) => (
          <Text style={[vf.h3, section.title === "Nutritionists" ? { marginTop: 18 } : { marginTop: 4 }]}>
            {section.title}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={vf.listPad}
        ListHeaderComponent={
          <View style={{ paddingBottom: 4 }}>
            <View style={vf.sectionHeadRow}>
              <View style={{ flex: 1 }}>
                <Text style={vf.h2}>Find professionals</Text>
                <Text style={vf.lead}>Search trainers and nutritionists like on the web app.</Text>
              </View>
            </View>
            <View style={vf.pillRow}>
              <Pressable style={vf.linkChip} onPress={() => navigation.navigate("DiscoverHome")}>
                <Text style={vf.linkChipLabel}>Browse all</Text>
              </Pressable>
            </View>
            <View style={vf.card}>
              <Text style={vf.label}>Search trainers and nutritionists</Text>
              <TextInput
                style={vf.input}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name, specialty, or bio…"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Text style={vf.muted}>
                Showing {trainerRows.length + nutritionistRows.length} of {(trainersQuery.data ?? []).length} professionals
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          trainersQuery.isLoading ? (
            <Text style={vf.muted}>Loading trainers...</Text>
          ) : trainersQuery.isError ? (
            <Text style={[vf.muted, { color: colors.danger }]}>Unable to load professionals.</Text>
          ) : (
            <Text style={vf.muted}>No professionals match your search.</Text>
          )
        }
      />
    </ScreenGradient>
  );
}
