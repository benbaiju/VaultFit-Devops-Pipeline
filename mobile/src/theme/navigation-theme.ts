import { DarkTheme, type Theme } from "@react-navigation/native";
import { colors } from "./colors";

export const vaultfitNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bgMain,
    card: colors.navHeader,
    text: colors.textPrimary,
    border: colors.borderStrong,
    notification: colors.vaultTeal,
  },
};
