import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { getMyProfile, sendPhoneOtp, updateMyProfile, verifyPhoneOtp } from "../../services/profiles";
import { createMyTrainerProfile, getMyTrainerProfile, updateMyTrainerProfile } from "../../services/trainers";
import { getMyVerificationRequests, submitVerificationRequest } from "../../services/verification";
import { useAuth } from "../../state/auth-context";
import { colors } from "../../theme/colors";
import { ScreenGradient, VerifiedBadge, vf } from "../../ui/vaultfit-ui";

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
    <ScreenGradient>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={vf.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={vf.h2}>My Profile</Text>
        <Text style={vf.lead}>{user?.email}</Text>
        <View style={vf.card}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <VerifiedBadge verified={Boolean(trainerQuery.data?.verified)} />
          </View>
          <Text style={vf.label}>Specialty</Text>
          <TextInput style={vf.input} value={specialty} onChangeText={setSpecialty} placeholder="Specialty" placeholderTextColor={colors.textMuted} />
          <Text style={vf.label}>Bio</Text>
          <TextInput
            style={[vf.input, styles.textarea]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholder="Bio"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={vf.primaryBtn} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Text style={vf.btnLabel}>{saveMutation.isPending ? "Saving..." : "Save profile"}</Text>
          </Pressable>
        </View>
        <View style={vf.card}>
          <Text style={vf.h3}>Phone verification</Text>
          <Text style={vf.label}>Phone</Text>
          <TextInput style={vf.input} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colors.textMuted} />
          <Pressable
            style={vf.secondaryBtn}
            disabled={!phone.trim() || profileUpdateMutation.isPending}
            onPress={() => profileUpdateMutation.mutate()}
          >
            <Text style={vf.btnLabel}>{profileUpdateMutation.isPending ? "Saving phone..." : "Save phone"}</Text>
          </Pressable>
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
        </View>
        <View style={vf.card}>
          <Text style={vf.h3}>Professional verification</Text>
          <Text style={vf.label}>Credential URL</Text>
          <TextInput
            style={vf.input}
            value={credentialUrl}
            onChangeText={setCredentialUrl}
            placeholder="Credential URL"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={vf.primaryBtn} disabled={!credentialUrl.trim() || verifyMutation.isPending} onPress={() => verifyMutation.mutate()}>
            <Text style={vf.btnLabel}>{verifyMutation.isPending ? "Submitting..." : "Submit verification"}</Text>
          </Pressable>
          <Text style={vf.muted}>
            Latest verification: {(verificationQuery.data ?? [])[0]?.status ?? "none"}
          </Text>
        </View>
      </ScrollView>
    </ScreenGradient>
  );
}

const styles = StyleSheet.create({
  textarea: { minHeight: 100, textAlignVertical: "top" },
});
