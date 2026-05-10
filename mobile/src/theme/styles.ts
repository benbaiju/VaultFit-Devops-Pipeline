import { StyleSheet } from "react-native";
import { colors } from "./colors";
import { Font } from "./fonts";

const radius = { sm: 8, md: 10, lg: 12, xl: 16 } as const;

/** Shared screen + card patterns (web dashboard aesthetic). */
export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgMain,
    padding: 14,
  },
  screenCentered: {
    flex: 1,
    backgroundColor: colors.bgMain,
    padding: 20,
    justifyContent: "center",
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 22,
    fontFamily: Font.outfitSemiBold,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtle: {
    color: colors.textSecondary,
    fontFamily: Font.outfitRegular,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  cardMarginTop: {
    marginTop: 10,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontFamily: Font.outfitSemiBold,
  },
});

export { radius };
