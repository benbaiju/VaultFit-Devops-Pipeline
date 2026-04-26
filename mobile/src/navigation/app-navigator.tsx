import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useAuth } from "../state/auth-context";
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
import { NotificationsScreen } from "../screens/common/notifications-screen";
import { TrainerOverviewScreen } from "../screens/trainer/trainer-overview-screen";
import { TrainerServicesScreen } from "../screens/trainer/trainer-services-screen";
import { TrainerBookingsScreen } from "../screens/trainer/trainer-bookings-screen";
import { TrainerPlansScreen } from "../screens/trainer/trainer-plans-screen";
import { TrainerProfileScreen } from "../screens/trainer/trainer-profile-screen";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const DiscoverStack = createNativeStackNavigator();

function ClientDiscoverStack() {
  return (
    <DiscoverStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#fff",
        contentStyle: { backgroundColor: "#020817" },
      }}
    >
      <DiscoverStack.Screen name="DiscoverHome" component={ClientDiscoverScreen} options={{ title: "Discover" }} />
      <DiscoverStack.Screen name="TrainerProfile" component={ClientTrainerProfileScreen} options={{ title: "Trainer Profile" }} />
    </DiscoverStack.Navigator>
  );
}

function ClientTabs() {
  return (
    <Tabs.Navigator screenOptions={baseTabOptions}>
      <Tabs.Screen name="Discover" component={ClientDiscoverStack} />
      <Tabs.Screen name="Bookings" component={ClientBookingsScreen} />
      <Tabs.Screen name="Reviews" component={ClientReviewsScreen} />
      <Tabs.Screen name="Messages" component={ClientMessagesScreen} />
      <Tabs.Screen name="Notifications" component={NotificationsScreen} />
      <Tabs.Screen name="Support" component={ClientSupportScreen} />
      <Tabs.Screen name="Profile" component={ClientProfileScreen} />
    </Tabs.Navigator>
  );
}

function TrainerTabs() {
  return (
    <Tabs.Navigator screenOptions={baseTabOptions}>
      <Tabs.Screen name="Overview" component={TrainerOverviewScreen} />
      <Tabs.Screen name="Services" component={TrainerServicesScreen} />
      <Tabs.Screen name="Bookings" component={TrainerBookingsScreen} />
      <Tabs.Screen name="Plans" component={TrainerPlansScreen} />
      <Tabs.Screen name="Messages" component={ClientMessagesScreen} />
      <Tabs.Screen name="Notifications" component={NotificationsScreen} />
      <Tabs.Screen name="Support" component={ClientSupportScreen} />
      <Tabs.Screen name="Profile" component={TrainerProfileScreen} />
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
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthFlow />
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: "#0f172a" },
            headerTintColor: "#fff",
            contentStyle: { backgroundColor: "#020817" },
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
    backgroundColor: "#0f172a",
    borderTopColor: "#1e293b",
  },
  tabBarActiveTintColor: "#a5b4fc",
  tabBarInactiveTintColor: "#94a3b8",
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#020817" },
  logoutText: { color: "#fda4af", fontWeight: "600" },
});
