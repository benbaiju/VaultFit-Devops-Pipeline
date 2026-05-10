import { Pressable, ScrollView, Text } from "react-native";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

type Props = {
  navigation: { navigate: (name: string) => void };
};

export function TrainerMoreScreen({ navigation }: Props) {
  return (
    <ScreenGradient>
      <ScrollView contentContainerStyle={vf.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={vf.h2}>More</Text>
        <Text style={vf.lead}>Trainer tools aligned with web navigation.</Text>

        <Pressable style={({ pressed }) => [vf.cardTouchable, pressed && { opacity: 0.95 }]} onPress={() => navigation.navigate("TrainerServices")}>
          <Text style={vf.cardTitle}>Services</Text>
          <Text style={vf.body}>Programs, availability, pricing.</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [vf.cardTouchable, pressed && { opacity: 0.95 }]} onPress={() => navigation.navigate("TrainerPlans")}>
          <Text style={vf.cardTitle}>Plans</Text>
          <Text style={vf.body}>Fitness and nutrition plans.</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [vf.cardTouchable, pressed && { opacity: 0.95 }]} onPress={() => navigation.navigate("TrainerNotifications")}>
          <Text style={vf.cardTitle}>Notifications</Text>
          <Text style={vf.body}>Alerts and reminders.</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [vf.cardTouchable, pressed && { opacity: 0.95 }]} onPress={() => navigation.navigate("TrainerSupport")}>
          <Text style={vf.cardTitle}>Support</Text>
          <Text style={vf.body}>Helpdesk threads.</Text>
        </Pressable>
      </ScrollView>
    </ScreenGradient>
  );
}
