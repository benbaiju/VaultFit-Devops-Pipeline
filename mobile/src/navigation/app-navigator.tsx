import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useAuth } from "../state/auth-context";
import { colors, Font, vaultfitNavigationTheme } from "../theme";
import { LoginScreen } from "../screens/auth/login-screen";
import { RegisterScreen } from "../screens/auth/register-screen";
import { PlaceholderScreen } from "../screens/common/placeholder-screen";
import { AdminControlScreen } from "../screens/admin/admin-control-screen";
import { AdminSupportScreen } from "../screens/admin/admin-support-screen";
import { ClientDiscoverScreen } from "../screens/client/client-discover-screen";
import { ClientBookingsScreen } from "../screens/client/client-bookings-screen";
import { ClientMessagesScreen } from "../screens/client/client-messages-screen";
import { ClientSupportScreen } from "../screens/client/client-support-screen";
import { ClientProfileScreen } from "../screens/client/client-profile-screen";
import { ClientTrainerProfileScreen } from "../screens/client/client-trainer-profile-screen";
import { ClientReviewsScreen } from "../screens/client/client-reviews-screen";
import { ClientMoreScreen } from "../screens/client/client-more-screen";
import { NotificationsScreen } from "../screens/common/notifications-screen";
import { TrainerOverviewScreen } from "../screens/trainer/trainer-overview-screen";
import { TrainerServicesScreen } from "../screens/trainer/trainer-services-screen";
import { TrainerBookingsScreen } from "../screens/trainer/trainer-bookings-screen";
import { TrainerPlansScreen } from "../screens/trainer/trainer-plans-screen";
import { TrainerProfileScreen } from "../screens/trainer/trainer-profile-screen";
import { TrainerMoreScreen } from "../screens/trainer/trainer-more-screen";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const DiscoverStack = createNativeStackNavigator();
const ClientMoreStack = createNativeStackNavigator();
const TrainerMoreStack = createNativeStackNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.navHeader },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontFamily: Font.outfitSemiBold },
  contentStyle: { backgroundColor: colors.bgMain },
};

function ClientDiscoverStack() {
  return (
    <DiscoverStack.Navigator
      screenOptions={{
        ...stackScreenOptions,
      }}
    >
      <DiscoverStack.Screen name="DiscoverHome" component={ClientDiscoverScreen} options={{ title: "Discover" }} />
      <DiscoverStack.Screen name="TrainerProfile" component={ClientTrainerProfileScreen} options={{ title: "Trainer Profile" }} />
    </DiscoverStack.Navigator>
  );
}

function ClientMoreMenuStack() {
  return (
    <ClientMoreStack.Navigator
      screenOptions={{
        ...stackScreenOptions,
      }}
    >
      <ClientMoreStack.Screen name="ClientMoreHome" component={ClientMoreScreen} options={{ title: "More" }} />
      <ClientMoreStack.Screen name="ClientReviews" component={ClientReviewsScreen} options={{ title: "Reviews" }} />
      <ClientMoreStack.Screen name="ClientNotifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <ClientMoreStack.Screen name="ClientSupport" component={ClientSupportScreen} options={{ title: "Support" }} />
    </ClientMoreStack.Navigator>
  );
}

function TrainerMoreMenuStack() {
  return (
    <TrainerMoreStack.Navigator
      screenOptions={{
        ...stackScreenOptions,
      }}
    >
      <TrainerMoreStack.Screen name="TrainerMoreHome" component={TrainerMoreScreen} options={{ title: "More" }} />
      <TrainerMoreStack.Screen name="TrainerServices" component={TrainerServicesScreen} options={{ title: "Services" }} />
      <TrainerMoreStack.Screen name="TrainerPlans" component={TrainerPlansScreen} options={{ title: "Plans" }} />
      <TrainerMoreStack.Screen name="TrainerNotifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <TrainerMoreStack.Screen name="TrainerSupport" component={ClientSupportScreen} options={{ title: "Support" }} />
    </TrainerMoreStack.Navigator>
  );
}

function ClientTabs() {
  return (
    <Tabs.Navigator screenOptions={baseTabOptions}>
      <Tabs.Screen name="Discover" component={ClientDiscoverStack} />
      <Tabs.Screen name="Bookings" component={ClientBookingsScreen} />
      <Tabs.Screen name="Messages" component={ClientMessagesScreen} />
      <Tabs.Screen name="Profile" component={ClientProfileScreen} />
      <Tabs.Screen name="More" component={ClientMoreMenuStack} />
    </Tabs.Navigator>
  );
}

function TrainerTabs() {
  return (
    <Tabs.Navigator screenOptions={baseTabOptions}>
      <Tabs.Screen name="Overview" component={TrainerOverviewScreen} />
      <Tabs.Screen name="Bookings" component={TrainerBookingsScreen} />
      <Tabs.Screen name="Messages" component={ClientMessagesScreen} />
      <Tabs.Screen name="Profile" component={TrainerProfileScreen} />
      <Tabs.Screen name="More" component={TrainerMoreMenuStack} />
    </Tabs.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tabs.Navigator screenOptions={baseTabOptions}>
      <Tabs.Screen name="Control" component={AdminControlScreen} />
      <Tabs.Screen name="Support" component={AdminSupportScreen} />
      <Tabs.Screen name="Profile" children={() => <PlaceholderScreen title="Admin Profile" subtitle="Account and session settings." />} />
    </Tabs.Navigator>
  );
}

function AuthFlow() {
  const [mode, setMode] = useState<"login" | "register">("login");
  return mode === "login" ? <LoginScreen onGoRegister={() => setMode("register")} /> : <RegisterScreen onGoLogin={() => setMode("login")} />;
}

export function AppNavigator() {
  const { user, isReady, isAuthenticated, logout } = useAuth();
  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.vaultTeal} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={vaultfitNavigationTheme}>
      {!isAuthenticated ? (
        <AuthFlow />
      ) : (
        <Stack.Navigator
          screenOptions={{
            ...stackScreenOptions,
            headerRight: () => (
              <Pressable onPress={() => void logout()}>
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            ),
          }}
        >
          {user?.role === "admin" ? (
            <Stack.Screen name="Admin" component={AdminTabs} />
          ) : user?.role === "trainer" || user?.role === "nutritionist" ? (
            <Stack.Screen name="Trainer" component={TrainerTabs} />
          ) : (
            <Stack.Screen name="Client" component={ClientTabs} />
          )}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const baseTabOptions = {
  headerShown: false,
  tabBarStyle: {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.borderStrong,
  },
  tabBarActiveTintColor: colors.primaryMuted,
  tabBarInactiveTintColor: colors.textSecondary,
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgMain },
  logoutText: { color: colors.dangerSoft, fontFamily: Font.outfitSemiBold },
});
