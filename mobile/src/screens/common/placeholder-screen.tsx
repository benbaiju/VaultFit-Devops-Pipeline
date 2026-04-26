import { StyleSheet, Text, View } from "react-native";

export function PlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020817", padding: 20, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "700", color: "#fff", marginBottom: 8 },
  subtitle: { color: "#94a3b8", fontSize: 15 },
});
