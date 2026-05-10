import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AuthVaultfitLayout } from "../../components/auth-vaultfit-layout";
import { VaultFitLogo } from "../../components/vaultfit-logo";
import { colors } from "../../theme/colors";
import { Font } from "../../theme/fonts";
import { useAuth } from "../../state/auth-context";

export function LoginScreen({ onGoRegister }: { onGoRegister: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    try {
      setIsLoading(true);
      await login(email.trim(), password);
    } catch (e) {
      Alert.alert("Login failed", (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthVaultfitLayout>
      <View style={styles.brand}>
        <VaultFitLogo size="lg" />
      </View>
      <Text style={styles.title}>Log in</Text>

      <Text style={styles.label}>Email</Text>
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

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="••••••••"
        placeholderTextColor={colors.placeholder}
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      <Pressable onPress={handleLogin} disabled={isLoading || !email || !password} style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}>
        <LinearGradient colors={[colors.ctaOrangeTop, colors.ctaOrangeBottom]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.cta}>
          <Text style={styles.ctaText}>{isLoading ? "Signing in..." : "Log in"}</Text>
        </LinearGradient>
      </Pressable>

      <Text style={styles.footer}>
        Not a member yet?{" "}
        <Text onPress={onGoRegister} style={styles.footerLink}>
          Sign up
        </Text>
      </Text>
    </AuthVaultfitLayout>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginBottom: 28 },
  title: {
    fontSize: 22,
    fontFamily: Font.outfitSemiBold,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 22,
  },
  label: {
    fontSize: 14,
    fontFamily: Font.outfitSemiBold,
    color: colors.textMuted,
    marginBottom: 6,
  },
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
    marginBottom: 4,
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
