import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { getMyProfile, sendPhoneOtp, updateMyProfile, verifyPhoneOtp } from "../../services/profiles";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={vf.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={vf.h2}>Profile</Text>
        <Text style={vf.lead}>Signed in as {user?.email}</Text>
        <View style={vf.card}>
          <Text style={vf.label}>Full name</Text>
          <TextInput
            style={[vf.input, nameLocked ? { opacity: 0.75 } : null]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
            editable={!nameLocked}
          />
          {nameLocked ? <Text style={vf.muted}>Name is locked after initial setup for client accounts.</Text> : null}
          <Text style={vf.label}>Phone</Text>
          <TextInput style={vf.input} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colors.textMuted} />
          <Pressable
            style={vf.secondaryBtn}
            disabled={!phone.trim() || sendOtpMutation.isPending || phoneAlreadyVerifiedForCurrentInput}
            onPress={() => sendOtpMutation.mutate()}
          >
            <Text style={vf.btnLabel}>
              {sendOtpMutation.isPending ? "Sending OTP..." : phoneAlreadyVerifiedForCurrentInput ? "Already verified" : "Send OTP"}
            </Text>
          </Pressable>
          <Text style={vf.label}>Verification code</Text>
          <TextInput
            style={vf.input}
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="Enter 6-digit OTP"
            maxLength={6}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
          <Pressable
            style={vf.secondaryBtn}
            disabled={otpCode.trim().length !== 6 || verifyOtpMutation.isPending || phoneAlreadyVerifiedForCurrentInput}
            onPress={() => verifyOtpMutation.mutate()}
          >
            <Text style={vf.btnLabel}>
              {verifyOtpMutation.isPending ? "Verifying..." : phoneAlreadyVerifiedForCurrentInput ? "Verified" : "Verify OTP"}
            </Text>
          </Pressable>
          {otpStatus ? <Text style={vf.muted}>{otpStatus}</Text> : null}
          {otpPreview ? <Text style={vf.muted}>Dev OTP: {otpPreview}</Text> : null}
          <Text style={[vf.label, { marginTop: 8 }]}>Timezone</Text>
          <TextInput style={vf.input} value={timezone} onChangeText={setTimezone} placeholder="Timezone" placeholderTextColor={colors.textMuted} />
          <Pressable style={vf.primaryBtn} onPress={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            <Text style={vf.btnLabel}>{updateMutation.isPending ? "Saving..." : "Save profile"}</Text>
          </Pressable>
        </View>
        {profileQuery.isLoading ? <Text style={vf.muted}>Loading profile...</Text> : null}
      </ScrollView>
    </ScreenGradient>
  );
}
