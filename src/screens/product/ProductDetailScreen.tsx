import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../components/AppIcon";
import { ConditionBadge, ConfirmDialog, PriceLabel, PrimaryButton, ScreenContainer, SecondaryButton } from "../../components/core";
import { WishlistButton } from "../../components/marketplace";
import { useApp } from "../../context/AppContext";
import { products } from "../../data/mockData";
import { colors, radius, spacing, typography } from "../../theme";

export function ProductDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const product = products.find((item) => item.id === route.params?.id) ?? products[0]!;
  const { wishlist, toggleWishlist } = useApp();
  const [purchase, setPurchase] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  return <ScreenContainer contentStyle={styles.noPad}><Image source={{ uri: product.image }} style={styles.hero}/><View style={styles.floating}><Pressable onPress={() => navigation.goBack()} style={styles.round}><AppIcon name="arrow-back" size={21} color={colors.charcoal}/></Pressable><WishlistButton active={wishlist.includes(product.id)} onPress={() => toggleWishlist(product.id)}/></View><View style={styles.body}><ConditionBadge condition={product.condition}/><Text style={styles.title}>{product.title}</Text><PriceLabel price={product.price} original={product.originalPrice}/><Text style={styles.meta}>{product.usage} · Purchased {product.purchaseYear} · {product.location}</Text><View style={styles.seller}><Image source={{ uri: product.sellerAvatar }} style={styles.avatar}/><View style={styles.flex}><Text style={styles.sellerName}>{product.seller}</Text><Text style={styles.meta}>★ {product.sellerRating} · Verified community seller</Text></View><AppIcon name="chevron-forward" size={19} color={colors.textSecondary}/></View><DetailSection title="Product details"><DetailRow label="Brand" value={product.brand}/><DetailRow label="Model" value={product.model}/><DetailRow label="Usage duration" value={product.usage}/><DetailRow label="Purchase year" value={String(product.purchaseYear)}/></DetailSection><DetailSection title="Description"><Text style={styles.description}>{product.description}</Text></DetailSection><View style={styles.defect}><AppIcon name="information-circle-outline" size={22} color={colors.warning}/><View style={styles.flex}><Text style={styles.defectTitle}>Known defects</Text><Text style={styles.description}>{product.defects}</Text></View></View><DetailSection title="Included & missing"><Text style={styles.description}>{product.accessories}</Text></DetailSection><View style={styles.disclaimer}><AppIcon name="shield-checkmark-outline" size={22} color={colors.green}/><Text style={styles.disclaimerText}>Inspect the item and verify its condition before completing any local transaction.</Text></View>{confirmed && <View style={styles.success}><AppIcon name="checkmark-circle" size={22} color={colors.green}/><Text style={styles.successText}>Purchase interest recorded locally. No payment was processed.</Text></View>}<View style={styles.actions}><SecondaryButton title="Chat with seller" icon={<AppIcon name="chatbubble-outline" size={19} color={colors.charcoal}/>} onPress={() => navigation.navigate("Conversation", { id: "c1" })} style={styles.flex}/><PrimaryButton title="Buy now" onPress={() => setPurchase(true)} style={styles.flex}/></View></View><ConfirmDialog visible={purchase} title={`Buy ${product.title}?`} message={`This will simulate purchase interest for LKR ${product.price.toLocaleString()}. No real payment or order will be created.`} confirmLabel="Confirm interest" onCancel={() => setPurchase(false)} onConfirm={() => { setPurchase(false); setConfirmed(true); }}/></ScreenContainer>;
}

function DetailSection({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}
function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  noPad: { paddingHorizontal: 0, paddingTop: 0 },
  hero: { width: "100%", height: 360, backgroundColor: colors.creamSecondary },
  floating: { position: "absolute", top: 42, left: spacing.md, right: spacing.md, flexDirection: "row", justifyContent: "space-between" },
  round: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.md },
  title: { ...typography.heading, color: colors.charcoal, marginTop: spacing.sm, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  seller: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 17 },
  flex: { flex: 1 },
  sellerName: { ...typography.medium, color: colors.charcoal },
  section: { paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionTitle: { ...typography.title, color: colors.charcoal, marginBottom: spacing.sm },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  detailLabel: { ...typography.body, color: colors.textSecondary },
  detailValue: { ...typography.medium, color: colors.charcoal },
  description: { ...typography.body, color: colors.textSecondary },
  defect: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.creamSecondary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  defectTitle: { ...typography.medium, color: colors.warning, marginBottom: 2 },
  disclaimer: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.greenSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  disclaimerText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  success: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  successText: { ...typography.caption, color: colors.green, flex: 1 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
});
