import React from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState, ErrorMessage, LoadingIndicator, ScreenContainer, SearchBar } from "../../components/core";
import { AppIcon } from "../../components/AppIcon";
import { ConversationCard, MessageBubble, ProductImage } from "../../components/marketplace";
import { useApp } from "../../context/AppContext";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { pickPhotos, uploadPhoto } from "../../services/photos";
import { colors, radius, spacing, typography } from "../../theme";
import { ConversationDetail } from "../../types";
import { messageTime } from "../../utils/format";

export function MessagesScreen({ navigation }: { navigation: any }) {
  const [query, setQuery] = React.useState("");
  const { refreshUnreadMessages } = useApp();
  const { data: conversations, error, loading } = useApiData(() => api.conversations());
  // Keep the tab and bell badges in step with what this list shows.
  React.useEffect(() => { if (conversations) refreshUnreadMessages(); }, [conversations, refreshUnreadMessages]);
  const needle = query.toLowerCase();
  const filtered = (conversations ?? []).filter((item) => item.person.toLowerCase().includes(needle) || item.productTitle.toLowerCase().includes(needle));
  return <ScreenContainer scroll={false} contentStyle={styles.screen}><View style={styles.header}><Text style={styles.title}>Messages</Text><Text style={styles.subtitle}>Talk directly with buyers and sellers</Text><SearchBar value={query} onChangeText={setQuery} placeholder="Search conversations"/>{error && <ErrorMessage message={error}/>}</View>{loading && !conversations ? <LoadingIndicator/> : <FlatList data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="No conversations" message="Messages about products will appear here."/>} renderItem={({ item }) => <ConversationCard conversation={item} onPress={() => navigation.navigate("Conversation", { id: item.id })}/>}/>}</ScreenContainer>;
}

/**
 * Opened with { id } for an existing thread, or { productId } from a product
 * page. In the second case the existing thread for that product is reused if
 * there is one; otherwise the first message starts it.
 */
export function ConversationScreen({ route }: { route: any }) {
  const productId: string | undefined = route.params?.productId;
  const [conversationId, setConversationId] = React.useState<string | undefined>(route.params?.id);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);

  const { data: detail, error, loading, setData } = useApiData<ConversationDetail | null>(async () => {
    let id = conversationId;
    if (!id && productId) id = (await api.conversations()).find((item) => item.productId === productId)?.id;
    if (!id) return null;
    if (id !== conversationId) setConversationId(id);
    return api.conversation(id);
  }, [conversationId, productId]);
  // Opening the thread marks it read on the server; update the badges.
  const { refreshUnreadMessages } = useApp();
  React.useEffect(() => { if (detail) refreshUnreadMessages(); }, [detail?.conversation.id, refreshUnreadMessages]);
  const productKey = productId ?? detail?.conversation.productId;
  const { data: product } = useApiData(async () => productKey ? api.product(productKey) : null, [productKey]);

  // Sends text, a photo, or both, starting the conversation if needed.
  const deliver = async (body: string, imageUrl?: string) => {
    if (detail) {
      const message = await api.sendMessage(detail.conversation.id, body, imageUrl);
      setData({ ...detail, messages: [...detail.messages, message] });
    } else if (productId) {
      const started = await api.startConversation(productId, body, imageUrl);
      setData(started);
      setConversationId(started.conversation.id);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await deliver(body);
      setDraft("");
    } catch (caught) {
      setSendError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  };

  // Picks one photo, uploads it, and sends it straight away with any typed text as its caption.
  const sendPhoto = async () => {
    if (sending) return;
    setSendError(null);
    try {
      const [asset] = await pickPhotos(1);
      if (!asset) return;
      setSending(true);
      await deliver(draft.trim(), await uploadPhoto(asset));
      setDraft("");
    } catch (caught) {
      setSendError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  };

  const title = product?.title ?? detail?.conversation.productTitle ?? "";
  const image = product?.image ?? detail?.conversation.productImage ?? "";
  if (loading && detail === undefined) return <ScreenContainer><LoadingIndicator/></ScreenContainer>;

  return <ScreenContainer scroll={false} contentStyle={styles.conversationScreen}><View style={styles.productBar}><ProductImage uri={image} style={styles.productImage}/><View style={styles.flex}><Text numberOfLines={1} style={styles.productTitle}>{title}</Text>{product && <Text style={styles.productPrice}>LKR {product.price.toLocaleString()}</Text>}</View><AppIcon name="chevron-forward" size={18} color={colors.textSecondary}/></View><ScrollView style={styles.bubbles}><Text style={styles.safety}>Keep communication in AgainBuy and inspect before paying.</Text>{error && <ErrorMessage message={error}/>}{!detail && !error && <Text style={styles.empty}>Say hello to {product?.seller ?? "the seller"} and ask about the item.</Text>}{detail?.messages.map((message) => <MessageBubble key={message.id} text={message.body} image={message.imageUrl} mine={message.isMine} time={messageTime(message.sentAt)}/>)}</ScrollView>{sendError && <ErrorMessage message={sendError}/>}<View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} onSubmitEditing={send} placeholder="Write a message…" placeholderTextColor={colors.textSecondary} style={styles.input}/><Pressable accessibilityRole="button" accessibilityLabel="Send a photo" disabled={sending} onPress={sendPhoto} style={[styles.photoButton, sending && styles.sending]}><AppIcon name="image-outline" size={21} color={colors.terracotta}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={sending} onPress={send} style={[styles.send, sending && styles.sending]}><AppIcon name="send" size={19} color={colors.white}/></Pressable></View></ScreenContainer>;
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.sm },
  header: { paddingHorizontal: spacing.md },
  title: { ...typography.heading, color: colors.charcoal },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  conversationScreen: { paddingHorizontal: spacing.md },
  productBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.xs, borderWidth: 1, borderColor: colors.border },
  productImage: { width: 52, height: 52, borderRadius: radius.sm },
  flex: { flex: 1 },
  productTitle: { ...typography.medium, color: colors.charcoal },
  productPrice: { ...typography.caption, color: colors.terracotta, marginTop: 2 },
  bubbles: { flex: 1, paddingTop: spacing.md },
  safety: { ...typography.label, color: colors.green, textAlign: "center", marginBottom: spacing.lg },
  composer: { flexDirection: "row", gap: spacing.xs, alignItems: "center", paddingVertical: spacing.sm },
  input: { flex: 1, minHeight: 48, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, color: colors.charcoal },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.terracotta, alignItems: "center", justifyContent: "center" },
  sending: { opacity: 0.6 },
  photoButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
});
