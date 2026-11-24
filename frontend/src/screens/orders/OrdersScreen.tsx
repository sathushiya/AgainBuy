import React from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../components/AppIcon";
import { EmptyState, ErrorMessage, FilterChip, LoadingIndicator, ScreenContainer, StatusBadge } from "../../components/core";
import { ProductImage } from "../../components/marketplace";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";
import { OrderSummary } from "../../types";
import { formatDate } from "../../utils/format";
import { BUYER_SECTIONS, SELLER_SECTIONS, nextStep } from "../../utils/orders";

/**
 * Buyer ("My orders") and seller ("Reserved by customers") dashboards. The
 * filter chips are the dashboard sections; each card opens the order.
 */
export function OrdersScreen({ navigation, route }: { navigation: any; route: any }) {
  const role: "buyer" | "seller" = route.params?.role === "seller" ? "seller" : "buyer";
  const sections = role === "seller" ? SELLER_SECTIONS : BUYER_SECTIONS;
  const [sectionKey, setSectionKey] = React.useState<string>(route.params?.section ?? sections[0]!.key);
  const { data: orders, error, loading } = useApiData(() => api.orders(role), [role]);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const section = sections.find((item) => item.key === sectionKey) ?? sections[0]!;
  const shown = (orders ?? []).filter(section.matches);

  const chat = async (order: OrderSummary) => {
    setActionError(null);
    try {
      const detail = await api.order(order.id);
      if (detail.conversationId) navigation.navigate("Conversation", { id: detail.conversationId });
      else navigation.navigate("Conversation", { productId: order.productId });
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };
  const downloadReceipt = async (order: OrderSummary) => {
    setActionError(null);
    try {
      await Linking.openURL(await api.orderFileUrl(order.id, "delivery-receipt"));
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  return <ScreenContainer>
    <Text style={styles.subtitle}>{role === "seller" ? "Buyers who reserved your listings, and every sale in progress." : "Items you've reserved and bought, from negotiation to delivery."}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{sections.map((item) => {
      const count = (orders ?? []).filter(item.matches).length;
      return <FilterChip key={item.key} label={count ? `${item.label} · ${count}` : item.label} selected={item.key === section.key} onPress={() => setSectionKey(item.key)}/>;
    })}</ScrollView>
    {(error || actionError) && <ErrorMessage message={(actionError ?? error)!}/>}
    {loading && !orders ? <LoadingIndicator/> : shown.length === 0
      ? <EmptyState icon={role === "seller" ? "list-outline" : "receipt-outline"} title={`No orders under ${section.label.toLowerCase()}`} message={role === "seller" ? "When a buyer reserves one of your listings, it appears here." : "Reserve an item from its product page to start."}/>
      : shown.map((order) => <OrderCard key={order.id} order={order} onOpen={() => navigation.navigate("OrderDetail", { id: order.id })} onChat={() => chat(order)} onReceipt={() => downloadReceipt(order)}/>)}
  </ScreenContainer>;
}

function OrderCard({ order, onOpen, onChat, onReceipt }: { order: OrderSummary; onOpen: () => void; onChat: () => void; onReceipt: () => void }) {
  const party = order.otherParty;
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open order for ${order.productTitle}`} onPress={onOpen} style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
      <ProductImage uri={order.productImage} style={styles.image}/>
      <View style={styles.flex}>
        <View style={styles.row}><Text numberOfLines={1} style={styles.title}>{order.productTitle}</Text></View>
        <StatusBadge status={order.status}/>
        <Text style={styles.price}>LKR {order.agreedPrice.toLocaleString()}</Text>
        <Text style={styles.meta}>Reserved {formatDate(order.createdAt)} · {order.deliveryMethod === "Delivery" ? `Delivery${order.courier ? ` · ${order.courier}` : ""}` : "Pickup"}</Text>
      </View>
    </Pressable>
    <View style={styles.party}>
      {party.avatar ? <Image source={{ uri: party.avatar }} style={styles.avatar}/> : <View style={[styles.avatar, styles.initials]}><Text style={styles.initialsText}>{party.name.slice(0, 1)}</Text></View>}
      <View style={styles.flex}><Text style={styles.partyName}>{order.isBuyer ? "Seller" : "Buyer"}: {party.name}</Text>{party.location ? <Text style={styles.meta}>{party.location}</Text> : null}</View>
    </View>
    <Text style={styles.next}>{nextStep(order)}</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.action}><Text style={styles.actionText}>View details</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onChat} style={styles.action}><AppIcon name="chatbubble-outline" size={16} color={colors.terracotta}/><Text style={styles.actionText}>Chat with {order.isBuyer ? "seller" : "buyer"}</Text></Pressable>
      {order.hasDeliveryReceipt && <Pressable accessibilityRole="button" onPress={onReceipt} style={styles.action}><AppIcon name="receipt-outline" size={16} color={colors.terracotta}/><Text style={styles.actionText}>Receipt</Text></Pressable>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  subtitle: { ...typography.body, color: colors.textSecondary },
  chips: { gap: spacing.xs, paddingVertical: spacing.md, paddingRight: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.sm, gap: spacing.sm },
  cardMain: { flexDirection: "row", gap: spacing.sm },
  pressed: { opacity: 0.82 },
  image: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.creamSecondary },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 4 },
  title: { ...typography.medium, color: colors.charcoal, flex: 1 },
  price: { ...typography.medium, color: colors.terracotta, marginTop: 4 },
  meta: { ...typography.label, color: colors.textSecondary, marginTop: 2 },
  party: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: 12, backgroundColor: colors.creamSecondary },
  initials: { alignItems: "center", justifyContent: "center" },
  initialsText: { ...typography.label, color: colors.terracotta },
  partyName: { ...typography.caption, color: colors.charcoal, fontWeight: "700" },
  next: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  action: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  actionText: { ...typography.caption, color: colors.terracotta, fontWeight: "700" },
});
