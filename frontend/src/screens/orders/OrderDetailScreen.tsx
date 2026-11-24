import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../components/AppIcon";
import { AppTextInput, ConfirmDialog, EmptyState, ErrorMessage, FilterChip, LoadingIndicator, PrimaryButton, ScreenContainer, SecondaryButton, StatusBadge } from "../../components/core";
import { ProductImage } from "../../components/marketplace";
import { OrderTimeline } from "../../components/orders";
import { COURIERS, courierWebsite } from "../../config/couriers";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { photoFile, pickPhotos } from "../../services/photos";
import { colors, radius, spacing, typography } from "../../theme";
import { CourierService, OrderAction, OrderDetail, OrderParty } from "../../types";
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
    {PAYMENT_STAGES.includes(summary.status) && <PaymentSection order={order} busy={busy} run={run}/>}
    {DELIVERY_STAGES.includes(summary.status) && <DeliverySection order={order} busy={busy} run={run}/>}

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

const PAYMENT_STAGES = ["Payment pending", "Payment verification pending", "Payment confirmed", "Shipped", "Ready for pickup", "Delivered", "Completed"];

/**
 * Bank transfer: the buyer pays outside the app and uploads the receipt; the
 * seller checks their own account before confirming. Uploading never confirms.
 */
function PaymentSection({ order, busy, run }: { order: OrderDetail; busy: string | null; run: (key: string, action: () => Promise<OrderDetail>) => Promise<void> }) {
  const [reference, setReference] = React.useState(order.paymentReference);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [confirmPaid, setConfirmPaid] = React.useState(false);
  const [viewError, setViewError] = React.useState<string | null>(null);
  const { summary } = order;
  const id = summary.id;
  const amount = `LKR ${summary.agreedPrice.toLocaleString()}`;

  const uploadReceipt = () => run("receipt", async () => {
    const [asset] = await pickPhotos(1);
    if (!asset) return order;
    return api.uploadPaymentReceipt(id, await photoFile(asset, "payment-receipt"), reference.trim());
  });
  const viewReceipt = async () => {
    setViewError(null);
    try {
      await Linking.openURL(await api.orderFileUrl(id, "payment-receipt"));
    } catch (caught) {
      setViewError(errorMessage(caught));
    }
  };

  return <Section title="Payment">
    {order.paymentConfirmedAt
      ? <View style={styles.confirmed}><AppIcon name="checkmark-circle" size={20} color={colors.green}/><Text style={styles.confirmedText}>Payment of {amount} confirmed by the seller on {formatDate(order.paymentConfirmedAt)}.</Text></View>
      : <Text style={styles.body}>{summary.isBuyer ? `Pay ${amount} by bank transfer to the seller, then upload your receipt. AgainBuy doesn't take payments.` : `The buyer pays ${amount} by bank transfer to your account and uploads the receipt.`}</Text>}

    {order.paymentInstructions !== "" && !order.paymentConfirmedAt && <View style={styles.bank}><Text style={styles.bankLabel}>{summary.isBuyer ? "Seller's bank details" : "Your bank details, shown to the buyer"}</Text><Text selectable style={styles.bankText}>{order.paymentInstructions}</Text></View>}

    {order.paymentSubmittedAt && !order.paymentConfirmedAt && <Text style={styles.meta}>Receipt sent {formatDate(order.paymentSubmittedAt)} at {messageTime(order.paymentSubmittedAt)}{order.paymentReference ? ` · reference ${order.paymentReference}` : ""}</Text>}
    {order.hasPaymentReceipt && <SecondaryButton title="View payment receipt" icon={<AppIcon name="receipt-outline" size={18} color={colors.charcoal}/>} onPress={viewReceipt} style={styles.chat}/>}
    {viewError && <ErrorMessage message={viewError}/>}

    {order.actions.includes("uploadReceipt") && <>
      <AppTextInput label="Transfer reference (optional)" value={reference} onChangeText={setReference} placeholder="e.g. the reference from your bank app"/>
      <PrimaryButton title={order.hasPaymentReceipt ? "Replace payment receipt" : "Upload payment receipt"} loading={busy === "receipt"} onPress={uploadReceipt}/>
      <Text style={styles.meta}>Upload a photo or screenshot of your bank transfer receipt. The seller confirms payment after checking their account.</Text>
    </>}

    {order.actions.includes("confirmPayment") && <>
      <PrimaryButton title="Confirm payment" loading={busy === "confirmPayment"} onPress={() => setConfirmPaid(true)}/>
      {rejecting
        ? <View style={styles.rejectBox}><AppTextInput label="What's wrong?" value={reason} onChangeText={setReason} placeholder="e.g. No transfer received yet"/><View style={styles.rejectActions}><SecondaryButton title="Back" onPress={() => setRejecting(false)} style={styles.flex}/><PrimaryButton title="Send to buyer" disabled={reason.trim().length < 3} loading={busy === "rejectPayment"} onPress={() => { setRejecting(false); void run("rejectPayment", () => api.rejectPayment(id, reason.trim())); }} style={styles.flex}/></View></View>
        : <SecondaryButton title="Payment not received" destructive onPress={() => setRejecting(true)}/>}
    </>}

    <ConfirmDialog visible={confirmPaid} title="Has the money reached your account?" message={`Only confirm once you've checked your bank and ${amount} has arrived. The buyer is told their payment is confirmed, and you'll then arrange the handover.`} confirmLabel="Yes, confirm payment" onCancel={() => setConfirmPaid(false)} onConfirm={() => { setConfirmPaid(false); void run("confirmPayment", () => api.confirmPayment(id)); }}/>
  </Section>;
}

const DELIVERY_STAGES = ["Payment confirmed", "Shipped", "Ready for pickup", "Delivered", "Completed"];

/**
 * Handover. Delivery: the seller books the courier on its website and records
 * the tracking number. Pickup: the seller marks it ready. Only the buyer can
 * confirm they received it.
 */
function DeliverySection({ order, busy, run }: { order: OrderDetail; busy: string | null; run: (key: string, action: () => Promise<OrderDetail>) => Promise<void> }) {
  const { summary } = order;
  const id = summary.id;
  const delivery = summary.deliveryMethod === "Delivery";
  const [courier, setCourier] = React.useState<CourierService | null>(summary.courier);
  const [tracking, setTracking] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [confirmReceived, setConfirmReceived] = React.useState(false);
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const website = courierWebsite(summary.courier ?? courier);

  // A courier website, or a signed link fetched on demand (it expires after a few minutes).
  const open = async (target: string | (() => Promise<string>)) => {
    setLinkError(null);
    try {
      await Linking.openURL(typeof target === "string" ? target : await target());
    } catch (caught) {
      setLinkError(errorMessage(caught));
    }
  };

  return <Section title={delivery ? "Delivery" : "Pickup"}>
    <Text style={styles.body}>{delivery ? `Delivery${summary.courier ? ` with ${summary.courier}` : ""}. ${order.dispatchedAt ? "" : "The seller books the courier on its website once payment is confirmed."}` : "Pickup only: agree the time and place in chat."}</Text>

    {order.dispatchedAt && <View style={styles.bank}>
      {delivery && <><Text style={styles.bankLabel}>Tracking number</Text><Text selectable style={styles.bankText}>{order.trackingNumber}</Text></>}
      <Text style={styles.bankLabel}>{delivery ? "Shipped" : "Ready for pickup"}</Text><Text style={styles.bankText}>{formatDate(order.dispatchedAt)} at {messageTime(order.dispatchedAt)}</Text>
      {order.deliveryNotes ? <><Text style={styles.bankLabel}>{delivery ? "Delivery notes" : "Pickup notes"}</Text><Text style={styles.bankText}>{order.deliveryNotes}</Text></> : null}
      {order.deliveredAt && <><Text style={styles.bankLabel}>Received by the buyer</Text><Text style={styles.bankText}>{formatDate(order.deliveredAt)} at {messageTime(order.deliveredAt)}</Text></>}
    </View>}
    {delivery && order.dispatchedAt && website && <Pressable accessibilityRole="link" onPress={() => open(website)}><Text style={styles.link}>Track it on the {summary.courier} website ↗</Text></Pressable>}

    {order.actions.includes("ship") && <>
      <Text style={styles.bankLabel}>Courier service</Text>
      <View style={styles.chips}>{COURIERS.map((item) => <FilterChip key={item.id} label={item.name} selected={courier === item.id} onPress={() => setCourier(item.id)}/>)}</View>
      {website && <Pressable accessibilityRole="link" onPress={() => open(website)}><Text style={styles.link}>Book the delivery on the {courier} website ↗</Text></Pressable>}
      <AppTextInput label="Tracking number" value={tracking} onChangeText={setTracking} placeholder="From the courier's booking confirmation"/>
      <AppTextInput label="Delivery notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="e.g. Expected in 2 working days"/>
      <PrimaryButton title="Mark as shipped" disabled={!courier || tracking.trim().length < 3} loading={busy === "ship"} onPress={() => run("ship", () => api.shipOrder(id, { courier: courier ?? undefined, trackingNumber: tracking.trim(), deliveryNotes: notes.trim() || undefined }))}/>
    </>}

    {order.actions.includes("readyForPickup") && <>
      <AppTextInput label="Pickup notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="e.g. Weekdays after 5pm, near the main gate"/>
      <PrimaryButton title="Mark ready for pickup" loading={busy === "readyForPickup"} onPress={() => run("readyForPickup", () => api.readyForPickup(id, notes.trim() || undefined))}/>
    </>}

    {order.actions.includes("confirmDelivery") && <PrimaryButton title="Confirm delivery" loading={busy === "confirmDelivery"} onPress={() => setConfirmReceived(true)}/>}

    {summary.hasDeliveryReceipt && <SecondaryButton title={`Download ${delivery ? "delivery" : "pickup"} receipt${order.deliveryReceiptNumber ? ` (${order.deliveryReceiptNumber})` : ""}`} icon={<AppIcon name="receipt-outline" size={18} color={colors.charcoal}/>} onPress={() => open(() => api.orderFileUrl(id, "delivery-receipt"))}/>}
    {linkError && <ErrorMessage message={linkError}/>}

    <ConfirmDialog visible={confirmReceived} title="Have you received the item?" message="Only confirm once it's in your hands and as described. This completes the purchase, and the seller is told it was delivered." confirmLabel="Yes, I received it" onCancel={() => setConfirmReceived(false)} onConfirm={() => { setConfirmReceived(false); void run("confirmDelivery", () => api.confirmDelivery(id)); }}/>
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
  bank: { backgroundColor: colors.creamSecondary, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  bankLabel: { ...typography.label, color: colors.textSecondary },
  bankText: { ...typography.medium, color: colors.charcoal },
  confirmed: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
  confirmedText: { ...typography.caption, color: colors.green, fontWeight: "700", flex: 1 },
  rejectBox: { gap: spacing.sm },
  rejectActions: { flexDirection: "row", gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  link: { ...typography.caption, color: colors.terracotta, fontWeight: "700" },
});
