import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { createMyTrainerProfile, getMyTrainerProfile } from "../../services/trainers";
import { getMyVerificationRequests, submitVerificationRequest } from "../../services/verification";
import { useAuth } from "../../state/auth-context";

export function TrainerProfileScreen() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const trainerQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
  });
  const verificationQuery = useQuery({
    queryKey: ["trainer-verification-requests"],
    queryFn: () => getMyVerificationRequests(token),
  });
  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [credentialUrl, setCredentialUrl] = useState("");

  useEffect(() => {
    if (!trainerQuery.data) return;
    setBio(trainerQuery.data.bio ?? "");
    setSpecialty(trainerQuery.data.specialty ?? "");
  }, [trainerQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => createMyTrainerProfile(token, { bio: bio.trim() || undefined, specialty: specialty.trim() || undefined, experienceYears: 1, hourlyRate: 90 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trainer-me"] });
      Alert.alert("Saved", "Trainer profile updated.");
    },
    onError: (e) => Alert.alert("Save failed", (e as Error).message),
  });
  const verifyMutation = useMutation({
    mutationFn: () => submitVerificationRequest(token, { credentialUrl: credentialUrl.trim() }),
    onSuccess: () => {
      setCredentialUrl("");
      void queryClient.invalidateQueries({ queryKey: ["trainer-verification-requests"] });
      Alert.alert("Submitted", "Verification request sent.");
    },
    onError: (e) => Alert.alert("Submit failed", (e as Error).message),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Profile</Text>
      <Text style={styles.subtle}>
        {user?.email} · {trainerQuery.data?.verified ? "Verified" : "Not verified"}
      </Text>
      <TextInput style={styles.input} value={specialty} onChangeText={setSpecialty} placeholder="Specialty" placeholderTextColor="#64748b" />
      <TextInput
        style={[styles.input, styles.textarea]}
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder="Bio"
        placeholderTextColor="#64748b"
      />
      <Pressable style={styles.button} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Text style={styles.buttonText}>{saveMutation.isPending ? "Saving..." : "Save profile"}</Text>
      </Pressable>
      <Text style={styles.section}>Verification</Text>
      <TextInput
        style={styles.input}
        value={credentialUrl}
        onChangeText={setCredentialUrl}
        placeholder="Credential URL"
        placeholderTextColor="#64748b"
      />
      <Pressable style={styles.button} disabled={!credentialUrl.trim() || verifyMutation.isPending} onPress={() => verifyMutation.mutate()}>
        <Text style={styles.buttonText}>{verifyMutation.isPending ? "Submitting..." : "Submit verification"}</Text>
      </Pressable>
      <Text style={styles.subtle}>
        Latest verification: {(verificationQuery.data ?? [])[0]?.status ?? "none"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", padding: 14 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtle: { color: "#94a3b8" },
  section: { color: "#cbd5e1", marginTop: 12, marginBottom: 8, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#334155", borderRadius: 8, color: "#fff", paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  button: { backgroundColor: "#4f46e5", borderRadius: 8, alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
