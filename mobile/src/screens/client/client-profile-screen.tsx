import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "../../services/profiles";
import { useAuth } from "../../state/auth-context";

export function ClientProfileScreen() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => getMyProfile(token),
  });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    if (!profileQuery.data) return;
    setFullName(profileQuery.data.full_name ?? "");
    setPhone(profileQuery.data.phone ?? "");
    setTimezone(profileQuery.data.timezone ?? "");
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => updateMyProfile(token, { fullName: fullName.trim() || undefined, phone: phone.trim() || undefined, timezone: timezone.trim() || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      Alert.alert("Profile updated", "Your profile has been saved.");
    },
    onError: (e) => Alert.alert("Update failed", (e as Error).message),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Profile</Text>
      <Text style={styles.subtle}>Signed in as {user?.email}</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor="#64748b" />
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="#64748b" />
      <TextInput style={styles.input} value={timezone} onChangeText={setTimezone} placeholder="Timezone" placeholderTextColor="#64748b" />
      <Pressable style={styles.button} onPress={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
        <Text style={styles.buttonText}>{updateMutation.isPending ? "Saving..." : "Save profile"}</Text>
      </Pressable>
      {profileQuery.isLoading ? <Text style={styles.subtle}>Loading profile...</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", padding: 14 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtle: { color: "#94a3b8", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#334155", borderRadius: 8, color: "#fff", paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  button: { backgroundColor: "#4f46e5", borderRadius: 8, alignItems: "center", paddingVertical: 10 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
