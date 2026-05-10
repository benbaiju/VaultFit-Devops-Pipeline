import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AuthVaultfitLayout } from "../../components/auth-vaultfit-layout";
import { VaultFitLogo } from "../../components/vaultfit-logo";
import { colors } from "../../theme/colors";
import { Font } from "../../theme/fonts";
import type { Role } from "../../types/api";
import { useAuth } from "../../state/auth-context";

export function RegisterScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("client");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    try {
      setIsLoading(true);
      await register({ fullName: fullName.trim(), email: email.trim(), password, role });
    } catch (e) {
      Alert.alert("Registration failed", (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthVaultfitLayout>
      <View style={styles.brand}>
        <VaultFitLogo size="lg" />
      </View>
      <Text style={styles.title}>Create an account</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="What should we call you?"
        placeholderTextColor={colors.placeholder}
        value={fullName}
        onChangeText={setFullName}
        autoComplete="name"
      />

      <Text style={[styles.label, styles.labelSpaced]}>Join as</Text>
      <View style={styles.roleRow}>
        {(["client", "trainer", "nutritionist"] as Role[]).map((item) => (
          <Pressable
            key={item}
            style={[styles.roleChip, role === item ? styles.roleChipActive : null]}
            onPress={() => setRole(item)}
          >
            <Text style={[styles.roleText, role === item ? styles.roleTextActive : null]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, styles.labelSpaced]}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="you@domain.com"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="••••••••"
        placeholderTextColor={colors.placeholder}
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      <Text style={styles.hint}>Must be at least 8 characters</Text>

      <Pressable
        onPress={handleRegister}
        disabled={isLoading || !fullName || !email || password.length < 8}
        style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}
      >
        <LinearGradient colors={[colors.ctaOrangeTop, colors.ctaOrangeBottom]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.cta}>
          <Text style={styles.ctaText}>{isLoading ? "Creating..." : "Create account"}</Text>
        </LinearGradient>
      </Pressable>

      <Text style={styles.footer}>
        Already have an account?{" "}
        <Text onPress={onGoLogin} style={styles.footerLink}>
          Sign in
        </Text>
      </Text>
    </AuthVaultfitLayout>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginBottom: 24 },
  title: {
    fontSize: 22,
    fontFamily: Font.outfitSemiBold,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: Font.outfitSemiBold,
    color: colors.textMuted,
    marginBottom: 6,
  },
  labelSpaced: { marginTop: 14 },
  input: {
    backgroundColor: colors.inputLightBg,
    borderWidth: 1,
    borderColor: colors.inputLightBorder,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: Font.outfitRegular,
    color: colors.textOnLight,
  },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: {
    borderWidth: 1,
    borderColor: colors.inputLightBorder,
    backgroundColor: colors.inputLightBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roleChipActive: {
    borderColor: colors.vaultTeal,
    backgroundColor: colors.vaultTealSoft,
  },
  roleText: {
    color: colors.textMuted,
    fontFamily: Font.outfitMedium,
    textTransform: "capitalize",
    fontSize: 15,
  },
  roleTextActive: { color: colors.textOnLight, fontFamily: Font.outfitSemiBold },
  hint: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: Font.outfitRegular,
    color: colors.textMuted,
  },
  ctaWrap: {
    marginTop: 22,
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: colors.ctaOrangeBottom,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaPressed: { opacity: 0.92 },
  cta: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: Font.outfitBold,
  },
  footer: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 15,
    fontFamily: Font.outfitRegular,
    color: colors.textSecondary,
  },
  footerLink: {
    color: colors.linkAuth,
    fontFamily: Font.outfitSemiBold,
  },
});
