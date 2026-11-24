import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, typography } from "../theme";
import { AppIcon } from "./AppIcon";

/**
 * The one way into the AgainBuy AI assistant, shown in the top bar of every
 * customer screen. On a product page, pass productId so it answers about that item.
 */
export function AssistantButton({ productId }: { productId?: string }) {
  const navigation = useNavigation<any>();
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={productId ? "Ask AgainBuy AI about this item" : "Ask AgainBuy AI"}
    hitSlop={6}
    onPress={() => navigation.navigate("Assistant", productId ? { productId } : undefined)}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <AppIcon name="sparkles-outline" size={16} color={colors.terracotta}/>
    <Text style={styles.label}>Ask AI</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", gap: 5, height: 36, paddingHorizontal: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.terracotta, backgroundColor: colors.white },
  pressed: { opacity: 0.75 },
  label: { ...typography.caption, color: colors.terracotta, fontWeight: "700" },
});
