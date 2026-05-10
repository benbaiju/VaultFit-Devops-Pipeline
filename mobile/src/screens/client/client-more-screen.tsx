import { Pressable, ScrollView, Text } from "react-native";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

type Props = {
  navigation: { navigate: (name: string) => void };
};

export function ClientMoreScreen({ navigation }: Props) {
  return (
    <ScreenGradient>
      <ScrollView contentContainerStyle={vf.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={vf.h2}>More</Text>
        <Text style={vf.lead}>Extra tools mirrored from the web client portal.</Text>

        <Pressable style={({ pressed }) => [vf.cardTouchable, pressed && { opacity: 0.95 }]} onPress={() => navigation.navigate("ClientReviews")}>
          <Text style={vf.cardTitle}>Reviews</Text>
          <Text style={vf.body}>See and manage your service reviews.</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [vf.cardTouchable, pressed && { opacity: 0.95 }]} onPress={() => navigation.navigate("ClientNotifications")}>
          <Text style={vf.cardTitle}>Notifications</Text>
          <Text style={vf.body}>Alerts and account updates.</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [vf.cardTouchable, pressed && { opacity: 0.95 }]} onPress={() => navigation.navigate("ClientSupport")}>
          <Text style={vf.cardTitle}>Support</Text>
          <Text style={vf.body}>Tickets and helpdesk.</Text>
        </Pressable>
      </ScrollView>
    </ScreenGradient>
  );
}
