import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { getMyProfile, sendPhoneOtp, updateMyProfile, verifyPhoneOtp } from "../../services/profiles";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme";

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
  const [otpCode, setOtpCode] = useState("");
  const [otpStatus, setOtpStatus] = useState("");
  const [otpPreview, setOtpPreview] = useState("");
  const nameLocked = Boolean(profileQuery.data?.full_name?.trim());

  useEffect(() => {
    if (!profileQuery.data) return;
    setFullName(profileQuery.data.full_name ?? "");
    setPhone(profileQuery.data.phone ?? "");
    setTimezone(profileQuery.data.timezone ?? "");
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMyProfile(token, {
        fullName: nameLocked ? undefined : fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        timezone: timezone.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      Alert.alert("Profile updated", "Your profile has been saved.");
    },
    onError: (e) => Alert.alert("Update failed", (e as Error).message),
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
      <Text style={styles.subtle}>Signed in as {user?.email}</Text>
      <TextInput
        style={[styles.input, nameLocked ? styles.inputLocked : null]}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name"
        placeholderTextColor={colors.textMuted}
        editable={!nameLocked}
      />
      {nameLocked ? <Text style={styles.subtle}>Name is locked after initial setup for client accounts.</Text> : null}
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colors.textMuted} />
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
      <TextInput style={styles.input} value={timezone} onChangeText={setTimezone} placeholder="Timezone" placeholderTextColor={colors.textMuted} />
      <Pressable style={styles.button} onPress={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
        <Text style={styles.buttonText}>{updateMutation.isPending ? "Saving..." : "Save profile"}</Text>
      </Pressable>
      {profileQuery.isLoading ? <Text style={styles.subtle}>Loading profile...</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 14 },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtle: { color: colors.textSecondary, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.chipBorder, borderRadius: 8, color: colors.textPrimary, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  inputLocked: { opacity: 0.7 },
  secondaryButton: { backgroundColor: colors.chipBorder, borderRadius: 8, alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  button: { backgroundColor: colors.primary, borderRadius: 8, alignItems: "center", paddingVertical: 10 },
  buttonText: { color: colors.textPrimary, fontWeight: "700" },
});
