import { Text, View } from "react-native";
import { ScreenGradient, vf } from "../../ui/vaultfit-ui";

export function PlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <ScreenGradient>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28 }}>
        <View style={[vf.card, { alignItems: "center", marginBottom: 0 }]}>
          <Text style={vf.h2}>{title}</Text>
          <Text style={[vf.lead, { marginBottom: 0, textAlign: "center" }]}>{subtitle}</Text>
        </View>
      </View>
    </ScreenGradient>
  );
}
