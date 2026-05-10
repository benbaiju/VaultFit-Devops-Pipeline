import type { PropsWithChildren } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, ScrollView, StyleSheet, Text, View, type TextStyle } from "react-native";
import { colors } from "../theme/colors";
import { Font } from "../theme/fonts";

/** Main background — matches web `body` radial feel (`index.css`). */
export function ScreenGradient({ children }: PropsWithChildren) {
  return (
    <LinearGradient
      colors={["rgba(79, 70, 229, 0.13)", "#060913", "rgba(6, 182, 212, 0.09)"]}
      locations={[0, 0.48, 1]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={vf.gradientFill}
    >
      {children}
    </LinearGradient>
  );
}

export function VFScrollScreen({ children }: PropsWithChildren) {
  return (
    <ScreenGradient>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={vf.scrollContent}
      >
        {children}
      </ScrollView>
    </ScreenGradient>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <View style={[vf.badge, verified ? vf.badgeSuccess : vf.badgeMuted]}>
      <Text style={verified ? vf.badgeSuccessLabel : vf.badgeMutedLabel}>{verified ? "VERIFIED" : "UNVERIFIED"}</Text>
    </View>
  );
}

/** Map booking-style status strings to muted web-ish colors. */
export function statusTone(status: string): TextStyle {
  const u = status.toUpperCase();
  if (["CONFIRMED", "APPROVED", "PAID", "ACTIVE"].includes(u)) return { color: "#34d399" };
  if (["PENDING"].includes(u)) return { color: "#fbbf24" };
  if (["CANCELLED", "REJECTED"].includes(u)) return { color: "#f87171" };
  if (["COMPLETED"].includes(u)) return { color: "#60a5fa" };
  return { color: colors.textMuted };
}

export const vf = StyleSheet.create({
  gradientFill: { flex: 1 },

  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32 },

  padded: { flex: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },

  listPad: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32 },

  h2: {
    fontSize: 26,
    fontFamily: Font.outfitBold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Font.outfitRegular,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  h3: {
    fontSize: 17,
    fontFamily: Font.outfitSemiBold,
    color: colors.textPrimary,
    marginBottom: 10,
    marginTop: 4,
  },

  sectionHeadRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  linkChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.35)",
    backgroundColor: colors.primarySoft,
  },
  linkChipLabel: {
    fontSize: 13,
    fontFamily: Font.outfitMedium,
    color: colors.textPrimary,
  },

  muted: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Font.outfitRegular,
    color: colors.textMuted,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Font.outfitRegular,
    color: colors.textSection,
    marginBottom: 4,
  },

  card: {
    backgroundColor: "rgba(16, 21, 36, 0.92)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 10,
  },
  cardTouchable: {
    backgroundColor: "rgba(16, 21, 36, 0.92)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },

  trainerCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: Font.outfitSemiBold,
    color: colors.textPrimary,
  },

  badge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  badgeSuccess: {
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  badgeMuted: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  badgeSuccessLabel: {
    fontSize: 11,
    fontFamily: Font.outfitBold,
    letterSpacing: 1,
    color: "#34d399",
    textTransform: "uppercase" as const,
  },
  badgeMutedLabel: {
    fontSize: 11,
    fontFamily: Font.outfitBold,
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: "uppercase" as const,
  },

  label: {
    fontSize: 13,
    fontFamily: Font.outfitSemiBold,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "rgba(0, 0, 0, 0.22)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: Font.outfitRegular,
    marginBottom: 12,
  },

  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 8,
  },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  btnLabel: {
    fontSize: 15,
    fontFamily: Font.outfitSemiBold,
    color: colors.textPrimary,
  },

  footerHint: {
    fontSize: 14,
    fontFamily: Font.outfitRegular,
    color: colors.primaryMuted,
    marginTop: 4,
  },

  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },

  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 14,
    opacity: 0.85,
  },

  kpiRow: { flexDirection: "row", gap: 12, marginTop: 4, marginBottom: 14 },
  kpiCard: {
    flex: 1,
    backgroundColor: "rgba(16, 21, 36, 0.88)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  kpiLabel: {
    fontSize: 11,
    fontFamily: Font.outfitSemiBold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  kpiValue: { fontSize: 26, fontFamily: Font.outfitBold, color: colors.textPrimary, letterSpacing: -0.5 },
});
