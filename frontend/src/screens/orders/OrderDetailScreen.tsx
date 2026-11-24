import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../components/AppIcon";
import { AppTextInput, ConfirmDialog, EmptyState, ErrorMessage, LoadingIndicator, PrimaryButton, ScreenContainer, SecondaryButton, StatusBadge } from "../../components/core";
import { ProductImage } from "../../components/marketplace";
import { OrderTimeline } from "../../components/orders";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";
import { OrderAction, OrderDetail, OrderParty } from "../../types";
import { formatDate, messageTime } from "../../utils/format";
import { nextStep } from "../../utils/orders";

/**
 * One order, for its buyer or seller. Buttons appear only for the actions
 * the API says this person may take now (order.actions), and the API checks
 * them again, so neither side can skip a step or act for the other.
 */
export function OrderDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const id: string = route.params?.id;
  const { data: order, error, loading, setData } = useApiData(() => api.order(id), [id]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  if (!order) return <ScreenContainer>{loading ? <LoadingIndicator/> : <EmptyState icon="receipt-outline" title="Order unavailable" message={error ?? "This order could not be found."} action="Go back" onAction={() => navigation.goBack()}/>}</ScreenContainer>;

  const can = (action: OrderAction) => order.actions.includes(action);
  /** Runs an order action and shows the updated order, or the API's reason for refusing. */
  const run = async (key: string, action: () => Promise<OrderDetail>) => {
    setBusy(key);
    setActionError(null);
    try {
      setData(await action());
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };
  const openChat = () => order.conversationId
    ? navigation.navigate("Conversation", { id: order.conversationId })
    : navigation.navigate("Conversation", { productId: order.summary.productId });

  const summary = order.summary;
  return <ScreenContainer keyboardAware>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${summary.productTitle}`} onPress={() => navigation.navigate("ProductDetail", { id: summary.productId })} style={styles.header}>
      <ProductImage uri={summary.productImage} style={styles.headerImage}/>
      <View style={styles.flex}>
        <Text style={styles.headerTitle}>{summary.productTitle}</Text>
        <StatusBadge status={summary.status}/>
        <Text style={styles.price}>LKR {summary.agreedPrice.toLocaleString()}</Text>
        <Text style={styles.meta}>Order {summary.id} · reserved {formatDate(summary.createdAt)}</Text>
      </View>
    </Pressable>
    <View style={styles.nextBox}><AppIcon name="information-circle-outline" size={20} color={colors.terracotta}/><Text style={styles.nextText}>{nextStep(summary)}</Text></View>

    <Section title="Buyer and seller">
      <PartyRow label="Buyer" party={order.buyer} you={summary.isBuyer}/>
      <PartyRow label="Seller" party={order.seller} you={!summary.isBuyer}/>
      <SecondaryButton title={`Chat with ${summary.isBuyer ? "seller" : "buyer"}`} icon={<AppIcon name="chatbubble-outline" size={18} color={colors.charcoal}/>} onPress={openChat} style={styles.chat}/>
    </Section>

    <Section title="Progress"><OrderTimeline order={order}/></Section>

    {summary.status === "Negotiating" && <NegotiationSection order={order} busy={busy} onPropose={(price) => run("price", () => api.proposePrice(order.summary.id, price))} onAgree={() => run("agree", () => api.agreeDeal(order.summary.id))}/>}

    {actionError && <ErrorMessage message={actionError}/>}
    {can("cancel") && <SecondaryButton title="Remove reservation" destructive onPress={() => setConfirmCancel(true)} style={styles.cancel}/>}

    <Section title="History">{[...order.history].reverse().map((change, index) => <View key={`${change.at}-${index}`} style={styles.historyRow}>
      <Text style={styles.historyStatus}>{change.status}</Text>
      {change.note ? <Text style={styles.historyNote}>{change.note}</Text> : null}
      <Text style={styles.meta}>{formatDate(change.at)} · {messageTime(change.at)}{change.actorName ? ` · ${change.actorName}` : ""}</Text>
    </View>)}</Section>

    <ConfirmDialog visible={confirmCancel} destructive title="Remove your reservation?" message="The item goes back on the marketplace for other buyers, and the seller is told. You can reserve it again later if it's still available." confirmLabel="Remove reservation" onCancel={() => setConfirmCancel(false)} onConfirm={() => { setConfirmCancel(false); void run("cancel", () => api.cancelReservation(order.summary.id)); }}/>
  </ScreenContainer>;
}

function NegotiationSection({ order, busy, onPropose, onAgree }: { order: OrderDetail; busy: string | null; onPropose: (price: number) => void; onAgree: () => void }) {
  const [draft, setDraft] = React.useState("");
  const price = Number(draft);
  const validPrice = draft.trim() !== "" && Number.isFinite(price) && price > 0 && price !== order.summary.agreedPrice;
  const you = order.summary.isBuyer ? order.buyerAgreedAt : order.sellerAgreedAt;
  const them = order.summary.isBuyer ? order.sellerAgreedAt : order.buyerAgreedAt;
  const other = order.summary.isBuyer ? "The seller" : "The buyer";

  return <Section title="Agree the deal">
    <Text style={styles.body}>Discuss the price and handover in chat. When you're happy, both of you confirm below; the order only moves on once you've both agreed.</Text>
    <View style={styles.agreeRow}><Text style={styles.meta}>Listed at LKR {order.listingPrice.toLocaleString()}</Text><Text style={styles.priceLarge}>Current price: LKR {order.summary.agreedPrice.toLocaleString()}</Text></View>
    <AgreementLine label="You" agreedAt={you}/>
    <AgreementLine label={other} agreedAt={them}/>
    {order.actions.includes("agree") && <PrimaryButton title={`Agree to deal at LKR ${order.summary.agreedPrice.toLocaleString()}`} loading={busy === "agree"} onPress={onAgree}/>}
    {order.actions.includes("proposePrice") && <View style={styles.proposeRow}>
      <View style={styles.flex}><AppTextInput label="Propose a different price (LKR)" keyboardType="numeric" value={draft} onChangeText={setDraft} placeholder={String(order.summary.agreedPrice)}/></View>
      <SecondaryButton title={busy === "price" ? "Saving…" : "Propose"} onPress={() => { if (validPrice && busy === null) { onPropose(price); setDraft(""); } }} style={styles.proposeButton}/>
    </View>}
    <Text style={styles.meta}>Changing the price resets both agreements.</Text>
  </Section>;
}

function AgreementLine({ label, agreedAt }: { label: string; agreedAt: string | null }) {
  return <View style={styles.agreement}><AppIcon name={agreedAt ? "checkmark-circle" : "chevron-forward"} size={18} color={agreedAt ? colors.green : colors.textSecondary}/><Text style={styles.agreementText}>{label}: {agreedAt ? `agreed on ${formatDate(agreedAt)} at ${messageTime(agreedAt)}` : "not agreed yet"}</Text></View>;
}

function PartyRow({ label, party, you }: { label: string; party: OrderParty; you: boolean }) {
  return <View style={styles.party}>
    {party.avatar ? <Image source={{ uri: party.avatar }} style={styles.avatar}/> : <View style={[styles.avatar, styles.initials]}><Text style={styles.initialsText}>{party.name.slice(0, 1)}</Text></View>}
    <View style={styles.flex}><Text style={styles.partyName}>{party.name}{you ? " (you)" : ""}</Text><Text style={styles.meta}>{label}{party.location ? ` · ${party.location}` : ""}</Text></View>
  </View>;
}

export function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  headerImage: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.creamSecondary },
  headerTitle: { ...typography.title, color: colors.charcoal, marginBottom: 4 },
  price: { ...typography.medium, color: colors.terracotta, marginTop: 4 },
  priceLarge: { ...typography.title, color: colors.terracotta },
  meta: { ...typography.label, color: colors.textSecondary, marginTop: 2 },
  body: { ...typography.body, color: colors.textSecondary },
  nextBox: { flexDirection: "row", gap: spacing.xs, alignItems: "center", backgroundColor: colors.creamSecondary, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
  nextText: { ...typography.caption, color: colors.charcoal, fontWeight: "700", flex: 1 },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  sectionTitle: { ...typography.title, color: colors.charcoal },
  party: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.creamSecondary },
  initials: { alignItems: "center", justifyContent: "center" },
  initialsText: { ...typography.medium, color: colors.terracotta },
  partyName: { ...typography.medium, color: colors.charcoal },
  chat: { alignSelf: "flex-start" },
  agreeRow: { gap: 2 },
  agreement: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  agreementText: { ...typography.caption, color: colors.charcoal },
  proposeRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  proposeButton: { minHeight: 48 },
  cancel: { marginTop: spacing.lg },
  historyRow: { borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.sm, paddingVertical: 4 },
  historyStatus: { ...typography.caption, color: colors.charcoal, fontWeight: "700" },
  historyNote: { ...typography.caption, color: colors.textSecondary },
});
