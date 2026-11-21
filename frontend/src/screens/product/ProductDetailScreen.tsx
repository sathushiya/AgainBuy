import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { AppIcon } from "../../components/AppIcon";
import { ConditionBadge, ConfirmDialog, EmptyState, ErrorMessage, LoadingIndicator, PriceLabel, PrimaryButton, ScreenContainer, SecondaryButton, StatusBadge } from "../../components/core";
import { ProductImage, WishlistButton } from "../../components/marketplace";
import { useApp } from "../../context/AppContext";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";

export function ProductDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const id: string = route.params?.id;
  const { data: product, error, loading, setData } = useApiData(() => api.product(id), [id]);
  const { wishlist, toggleWishlist } = useApp();
  const [purchase, setPurchase] = React.useState(false);
  const [buying, setBuying] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);

  if (!product) return <ScreenContainer>{loading ? <LoadingIndicator/> : <EmptyState icon="search-outline" title="Product unavailable" message={error ?? "This listing could not be found."} action="Go back" onAction={() => navigation.goBack()}/>}</ScreenContainer>;

  const buy = async () => {
    setPurchase(false);
    setBuying(true);
    try {
      const order = await api.purchase(product.id);
      setData({ ...product, status: "Reserved" });
      setNotice({ ok: true, text: `Reserved for you (${order.id}). Arrange a meetup with ${product.seller}; no payment was processed.` });
    } catch (caught) {
      setNotice({ ok: false, text: errorMessage(caught) });
    } finally {
      setBuying(false);
    }
  };

  const actions = product.isOwn
    ? <View style={styles.success}><AppIcon name="information-circle-outline" size={22} color={colors.textSecondary}/><Text style={styles.ownText}>This is your listing. Manage it from My Listings.</Text></View>
    : <View style={styles.actions}><SecondaryButton title="Chat with seller" icon={<AppIcon name="chatbubble-outline" size={19} color={colors.charcoal}/>} onPress={() => navigation.navigate("Conversation", { productId: product.id })} style={styles.flex}/><PrimaryButton title={product.status === "Active" ? "Buy now" : product.status} disabled={product.status !== "Active"} loading={buying} onPress={() => setPurchase(true)} style={styles.flex}/></View>;

  return <ScreenContainer contentStyle={styles.noPad}><Gallery images={product.images.length ? product.images : [product.image]} title={product.title}/><View style={styles.floating}><Pressable onPress={() => navigation.goBack()} style={styles.round}><AppIcon name="arrow-back" size={21} color={colors.charcoal}/></Pressable><WishlistButton active={wishlist.includes(product.id)} onPress={() => toggleWishlist(product.id)}/></View><View style={styles.body}><View style={styles.badges}><ConditionBadge condition={product.condition}/>{product.status !== "Active" && <StatusBadge status={product.status}/>}</View><Text style={styles.title}>{product.title}</Text><PriceLabel price={product.price} original={product.originalPrice ?? undefined}/><Text style={styles.meta}>{product.usage} · Purchased {product.purchaseYear} · {product.location}</Text><View style={styles.seller}><Image source={{ uri: product.sellerAvatar }} style={styles.avatar}/><View style={styles.flex}><Text style={styles.sellerName}>{product.seller}</Text><Text style={styles.meta}>★ {product.sellerRating} · Verified community seller</Text></View><AppIcon name="chevron-forward" size={19} color={colors.textSecondary}/></View><DetailSection title="Product details"><DetailRow label="Brand" value={product.brand}/><DetailRow label="Model" value={product.model}/><DetailRow label="Usage duration" value={product.usage}/><DetailRow label="Purchase year" value={String(product.purchaseYear)}/></DetailSection><DetailSection title="Description"><Text style={styles.description}>{product.description}</Text></DetailSection><View style={styles.defect}><AppIcon name="information-circle-outline" size={22} color={colors.warning}/><View style={styles.flex}><Text style={styles.defectTitle}>Known defects</Text><Text style={styles.description}>{product.defects}</Text></View></View><DetailSection title="Included & missing"><Text style={styles.description}>{product.accessories || "Not specified"}</Text></DetailSection><View style={styles.disclaimer}><AppIcon name="shield-checkmark-outline" size={22} color={colors.green}/><Text style={styles.disclaimerText}>Inspect the item and verify its condition before completing any local transaction.</Text></View>{notice && (notice.ok ? <View style={styles.success}><AppIcon name="checkmark-circle" size={22} color={colors.green}/><Text style={styles.successText}>{notice.text}</Text></View> : <View style={styles.notice}><ErrorMessage message={notice.text}/></View>)}{actions}</View><ConfirmDialog visible={purchase} title={`Buy ${product.title}?`} message={`This reserves the item for you at LKR ${product.price.toLocaleString()} and schedules a meetup with the seller. No payment is taken in the app.`} confirmLabel="Reserve item" onCancel={() => setPurchase(false)} onConfirm={buy}/></ScreenContainer>;
}

function Gallery({ images, title }: { images: string[]; title: string }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = React.useState(0);
  if (images.length <= 1) return <ProductImage uri={images[0] ?? ""} style={styles.hero} label={`${title} product photo`}/>;
  return <View><ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}>{images.map((uri, position) => <ProductImage key={uri} uri={uri} style={[styles.hero, { width }]} label={`${title} photo ${position + 1} of ${images.length}`}/>)}</ScrollView><View style={styles.counter}><Text style={styles.counterText}>{index + 1} / {images.length}</Text></View></View>;
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
  counter: { position: "absolute", bottom: spacing.sm, right: spacing.md, borderRadius: radius.full, backgroundColor: "rgba(41,41,41,0.7)", paddingHorizontal: spacing.sm, paddingVertical: 3 },
  counterText: { ...typography.label, color: colors.white },
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
  ownText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  notice: { marginTop: spacing.md },
  badges: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
  successText: { ...typography.caption, color: colors.green, flex: 1 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
});
