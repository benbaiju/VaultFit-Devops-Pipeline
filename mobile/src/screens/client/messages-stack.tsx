import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors, Font } from "../../theme";
import { ClientChatThreadScreen } from "./client-chat-thread-screen";
import { ClientMessagesInboxScreen } from "./client-messages-inbox-screen";
import type { MessagesStackParamList } from "./messaging-types";

const Stack = createNativeStackNavigator<MessagesStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.navHeader },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontFamily: Font.outfitSemiBold },
  contentStyle: { backgroundColor: colors.bgMain },
};

/** Full messages flow: inbox → dedicated chat screen (better keyboard + sending UX). */
export function MessagesStackNavigator() {
  return (
    <Stack.Navigator initialRouteName="MessagesInbox" screenOptions={screenOptions}>
      <Stack.Screen name="MessagesInbox" component={ClientMessagesInboxScreen} options={{ title: "Messages" }} />
      <Stack.Screen name="ChatThread" component={ClientChatThreadScreen} options={{ title: "Chat" }} />
    </Stack.Navigator>
  );
}
