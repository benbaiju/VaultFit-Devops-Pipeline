import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors, Font } from "../../theme";
import { ClientSupportScreen } from "./client-support-screen";
import { ClientSupportTicketScreen } from "./client-support-ticket-screen";
import type { SupportStackParamList } from "./support-types";

const Stack = createNativeStackNavigator<SupportStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.navHeader },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontFamily: Font.outfitSemiBold },
  contentStyle: { backgroundColor: colors.bgMain },
};

export function SupportStackNavigator() {
  return (
    <Stack.Navigator initialRouteName="SupportHome" screenOptions={screenOptions}>
      <Stack.Screen name="SupportHome" component={ClientSupportScreen} options={{ title: "Support" }} />
      <Stack.Screen name="SupportTicket" component={ClientSupportTicketScreen} options={{ title: "Ticket" }} />
    </Stack.Navigator>
  );
}
