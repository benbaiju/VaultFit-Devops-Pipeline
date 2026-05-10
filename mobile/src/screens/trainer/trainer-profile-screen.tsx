import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { getMyProfile, sendPhoneOtp, updateMyProfile, verifyPhoneOtp } from "../../services/profiles";
import { createMyTrainerProfile, getMyTrainerProfile, updateMyTrainerProfile } from "../../services/trainers";
import { getMyVerificationRequests, submitVerificationRequest } from "../../services/verification";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme";

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
  const profileQuery = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => getMyProfile(token),
  });
  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [credentialUrl, setCredentialUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStatus, setOtpStatus] = useState("");
  const [otpPreview, setOtpPreview] = useState("");

  useEffect(() => {
    if (!trainerQuery.data) return;
    setBio(trainerQuery.data.bio ?? "");
    setSpecialty(trainerQuery.data.specialty ?? "");
  }, [trainerQuery.data]);
  useEffect(() => {
    setPhone(profileQuery.data?.phone ?? "");
  }, [profileQuery.data?.phone]);

  const saveMutation = useMutation({
    mutationFn: () =>
      trainerQuery.data?.id
        ? updateMyTrainerProfile(token, trainerQuery.data.id, {
            bio: bio.trim() || undefined,
            specialty: specialty.trim() || undefined,
            experienceYears: trainerQuery.data.experience_years ?? 1,
            hourlyRate: trainerQuery.data.hourly_rate ?? 90,
          })
        : createMyTrainerProfile(token, { bio: bio.trim() || undefined, specialty: specialty.trim() || undefined, experienceYears: 1, hourlyRate: 90 }),
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
  const profileUpdateMutation = useMutation({
    mutationFn: () => updateMyProfile(token, { phone: phone.trim() || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      Alert.alert("Saved", "Phone updated.");
    },
    onError: (e) => Alert.alert("Save failed", (e as Error).message),
  });
  const normalizedCurrentPhone = phone.trim().replace(/[\s\-()]/g, "");
  const normalizedSavedPhone = (profileQuery.data?.phone ?? "").trim().replace(/[\s\-()]/g, "");
  const phoneAlreadyVerifiedForCurrentInput =
    Boolean(profileQuery.data?.phone_verified) &&
    Boolean(normalizedCurrentPhone) &&
    normalizedCurrentPhone === normalizedSavedPhone;
  const sendOtpMutation = useMutation({
    mutationFn: () => sendPhoneOtp(token, phone.trim()),
    onSuccess: (payload) => {
      setOtpStatus("OTP sent to your phone number.");
      setOtpPreview(payload.otpPreview ?? "");
    },
    onError: (e) => Alert.alert("OTP failed", (e as Error).message),
  });
  const verifyOtpMutation = useMutation({
    mutationFn: () => verifyPhoneOtp(token, otpCode.trim()),
    onSuccess: () => {
      setOtpStatus("Phone number verified.");
      setOtpCode("");
      setOtpPreview("");
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
    },
    onError: (e) => Alert.alert("Verify failed", (e as Error).message),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Profile</Text>
      <Text style={styles.subtle}>
        {user?.email} · {trainerQuery.data?.verified ? "Verified" : "Not verified"}
      </Text>
      <TextInput style={styles.input} value={specialty} onChangeText={setSpecialty} placeholder="Specialty" placeholderTextColor={colors.textMuted} />
      <TextInput
        style={[styles.input, styles.textarea]}
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder="Bio"
        placeholderTextColor={colors.textMuted}
      />
      <Pressable style={styles.button} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Text style={styles.buttonText}>{saveMutation.isPending ? "Saving..." : "Save profile"}</Text>
      </Pressable>
      <Text style={styles.section}>Phone verification</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colors.textMuted} />
      <Pressable style={styles.secondaryButton} disabled={!phone.trim() || profileUpdateMutation.isPending} onPress={() => profileUpdateMutation.mutate()}>
        <Text style={styles.buttonText}>{profileUpdateMutation.isPending ? "Saving phone..." : "Save phone"}</Text>
      </Pressable>
      <Pressable
        style={styles.secondaryButton}
        disabled={!phone.trim() || sendOtpMutation.isPending || phoneAlreadyVerifiedForCurrentInput}
        onPress={() => sendOtpMutation.mutate()}
      >
        <Text style={styles.buttonText}>
          {sendOtpMutation.isPending ? "Sending OTP..." : phoneAlreadyVerifiedForCurrentInput ? "Already verified" : "Send OTP"}
        </Text>
      </Pressable>
      <TextInput
        style={styles.input}
        value={otpCode}
        onChangeText={setOtpCode}
        placeholder="Enter 6-digit OTP"
        maxLength={6}
        placeholderTextColor={colors.textMuted}
      />
      <Pressable
        style={styles.secondaryButton}
        disabled={otpCode.trim().length !== 6 || verifyOtpMutation.isPending || phoneAlreadyVerifiedForCurrentInput}
        onPress={() => verifyOtpMutation.mutate()}
      >
        <Text style={styles.buttonText}>
          {verifyOtpMutation.isPending ? "Verifying..." : phoneAlreadyVerifiedForCurrentInput ? "Verified" : "Verify OTP"}
        </Text>
      </Pressable>
      {otpStatus ? <Text style={styles.subtle}>{otpStatus}</Text> : null}
      {otpPreview ? <Text style={styles.subtle}>Dev OTP: {otpPreview}</Text> : null}
      <Text style={styles.section}>Verification</Text>
      <TextInput
        style={styles.input}
        value={credentialUrl}
        onChangeText={setCredentialUrl}
        placeholder="Credential URL"
        placeholderTextColor={colors.textMuted}
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
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 14 },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtle: { color: colors.textSecondary },
  section: { color: colors.textSection, marginTop: 12, marginBottom: 8, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 8, color: colors.textPrimary, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  button: { backgroundColor: colors.primary, borderRadius: 8, alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  secondaryButton: { backgroundColor: colors.chipBorder, borderRadius: 8, alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  buttonText: { color: colors.textPrimary, fontWeight: "700" },
});
