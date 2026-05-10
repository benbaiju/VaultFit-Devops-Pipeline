import { StyleSheet, Text, View } from "react-native";
import { colors, Font } from "../../theme";

export function PlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgMain, padding: 20, justifyContent: "center" },
  title: { fontSize: 26, fontFamily: Font.outfitBold, color: colors.textPrimary, marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { color: colors.textSecondary, fontSize: 15, fontFamily: Font.outfitRegular },
});
