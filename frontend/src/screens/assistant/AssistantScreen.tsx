import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { ErrorMessage, LoadingIndicator, ScreenContainer } from "../../components/core";
import { MessageBubble, ProductImage } from "../../components/marketplace";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";
import { AssistantConversationSummary, AssistantMessage, Product } from "../../types";
import { messageTime } from "../../utils/format";

const MAX_LENGTH = 1000;

const GENERAL_QUESTIONS = ["What phones are for sale?", "Anything under LKR 15,000?", "How does reserving an item work?", "How do I pay safely?"];
const PRODUCT_QUESTIONS = ["Does it have any defects?", "What comes with it?", "Is delivery available?", "How do I reserve it?"];

/** The models sometimes add markdown; the chat shows plain text. */
const plain = (text: string) => text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/^\s*[-*]\s+/gm, "• ");

/**
 * The AgainBuy AI assistant. Conversations are saved on the server for the
 * signed-in user. Route params: conversationId to reopen one from History;
 * productId to start a new chat about a listing. Every answer ends with four
 * follow-up questions that can be tapped to ask them.
 */
export function AssistantScreen({ navigation, route }: { navigation: any; route: any }) {
  const conversationId: string | undefined = route.params?.conversationId;
  const productId: string | undefined = route.params?.productId;
  const [conversation, setConversation] = React.useState<AssistantConversationSummary | null>(null);
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
  const [opening, setOpening] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const scroll = React.useRef<ScrollView>(null);

  // A new chat about a listing shows which one; saved chats carry their own title.
  const { data: product } = useApiData(async () => productId && !conversationId ? api.product(productId) : null, [productId, conversationId]);

  // Open the conversation named in the route (from History), or start empty for a new chat.
  React.useEffect(() => {
    setError(null);
    if (!conversationId) {
      setConversation(null);
      setMessages([]);
      return;
    }
    if (conversation?.id === conversationId) return; // just created on this screen
    let cancelled = false;
    setOpening(true);
    api.assistantConversation(conversationId)
      .then((saved) => { if (!cancelled) { setConversation(saved.conversation); setMessages(saved.messages); } })
      .catch((caught) => { if (!cancelled) setError(errorMessage(caught)); })
      .finally(() => { if (!cancelled) setOpening(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the chat changes
  }, [conversationId]);

  const startNewChat = React.useCallback(() => navigation.setParams({ conversationId: undefined, productId: undefined }), [navigation]);
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <View style={styles.headerActions}>
        {conversation && <HeaderButton icon="create-outline" label="New chat" onPress={startNewChat}/>}
        <HeaderButton icon="time-outline" label="History" onPress={() => navigation.navigate("AssistantHistory")}/>
      </View>,
    });
  }, [navigation, conversation, startNewChat]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    setPending(text);
    setDraft("");
    setError(null);
    try {
      const exchange = conversation
        ? await api.askAssistant(conversation.id, text)
        : await api.startAssistantConversation(text, productId);
      setConversation(exchange.conversation);
      setMessages((current) => [...current, exchange.question, exchange.answer]);
      // Keep the saved chat in the route, so going back and forth reopens it.
      if (!conversation) navigation.setParams({ conversationId: exchange.conversation.id });
    } catch (caught) {
      setError(errorMessage(caught));
      // Nothing was saved; put the question back to try again.
      setDraft(text);
    } finally {
      setPending(null);
    }
  };

  const listingTitle = conversation ? conversation.productTitle : product?.title;
  const aboutListing = conversation ? !!conversation.productId : !!productId;
  const lastAnswerId = [...messages].reverse().find((message) => message.role === "assistant")?.id;
  return <ScreenContainer scroll={false} keyboardAware contentStyle={styles.screen}>
    {listingTitle && <View style={styles.productBar}>{product && <ProductImage uri={product.image} style={styles.productImage}/>}<View style={styles.flex}><Text style={styles.productLabel}>Asking about</Text><Text numberOfLines={1} style={styles.productTitle}>{listingTitle}</Text></View></View>}
    {opening ? <LoadingIndicator label="Opening chat…"/> : <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.chat} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
      {messages.length === 0 && !pending && <>
        <View style={styles.intro}>
          <View style={styles.introIcon}><AppIcon name="sparkles-outline" size={22} color={colors.terracotta}/></View>
          <Text style={styles.introTitle}>Hi! I'm the AgainBuy assistant.</Text>
          <Text style={styles.introText}>{aboutListing ? "Ask me about this item, or how to reserve, pay and arrange delivery." : "Ask me what's for sale, within your budget, or how to buy, sell and pay safely."} Your chats are saved in History. I can't see your orders, and I can make mistakes, so check important details with the seller.</Text>
        </View>
        <Suggestions questions={aboutListing ? PRODUCT_QUESTIONS : GENERAL_QUESTIONS} onAsk={ask} disabled={!!pending}/>
      </>}
      {messages.map((message) => message.role === "user"
        ? <MessageBubble key={message.id} text={message.content} mine time={messageTime(message.createdAt)}/>
        : <View key={message.id}>
            <MessageBubble text={plain(message.content)} time={messageTime(message.createdAt)}/>
            {message.products.length > 0 && <ProductCards products={message.products} onOpen={(id) => navigation.navigate("ProductDetail", { id })}/>}
            {message.suggestions.length > 0 && <Suggestions questions={message.suggestions} onAsk={ask} disabled={!!pending} muted={message.id !== lastAnswerId}/>}
          </View>)}
      {pending && <>
        <MessageBubble text={pending} mine time="Sending…"/>
        <View style={styles.thinking}><ActivityIndicator size="small" color={colors.terracotta}/><Text style={styles.thinkingText}>Thinking…</Text></View>
      </>}
      {error && <ErrorMessage message={error}/>}
    </ScrollView>}
    <View style={styles.composer}>
      <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => ask(draft)} maxLength={MAX_LENGTH} placeholder={conversation ? "Ask a follow-up…" : "Ask a question…"} placeholderTextColor={colors.textSecondary} style={styles.input} editable={!pending && !opening}/>
      <Pressable accessibilityRole="button" accessibilityLabel="Ask" disabled={!!pending || opening || !draft.trim()} onPress={() => ask(draft)} style={[styles.send, (!!pending || opening || !draft.trim()) && styles.disabled]}><AppIcon name="send" size={19} color={colors.white}/></Pressable>
    </View>
  </ScreenContainer>;
}

function HeaderButton({ icon, label, onPress }: { icon: AppIconName; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
    <AppIcon name={icon} size={17} color={colors.terracotta}/>
    <Text style={styles.headerButtonText}>{label}</Text>
  </Pressable>;
}

/** Tappable follow-up questions. Older answers' suggestions stay usable but quieter. */
function Suggestions({ questions, onAsk, disabled, muted }: { questions: string[]; onAsk: (question: string) => void; disabled: boolean; muted?: boolean }) {
  return <View style={styles.suggestions}>{questions.map((question) => <Pressable key={question} accessibilityRole="button" accessibilityLabel={`Ask: ${question}`} disabled={disabled} onPress={() => onAsk(question)} style={({ pressed }) => [styles.suggestion, muted && styles.suggestionMuted, pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={[styles.suggestionText, muted && styles.suggestionTextMuted]}>{question}</Text>
  </Pressable>)}</View>;
}

function ProductCards({ products, onOpen }: { products: Product[]; onOpen: (id: string) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>{products.map((product) => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`Open ${product.title}, LKR ${product.price.toLocaleString()}`} onPress={() => onOpen(product.id)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <ProductImage uri={product.image} style={styles.cardImage}/>
    <Text numberOfLines={2} style={styles.cardTitle}>{product.title}</Text>
    <Text style={styles.cardPrice}>LKR {product.price.toLocaleString()}</Text>
    <Text numberOfLines={1} style={styles.cardMeta}>{product.status === "Active" ? `${product.condition} · ${product.location}` : product.status}</Text>
  </Pressable>)}</ScrollView>;
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.md },
  flex: { flex: 1 },
  headerActions: { flexDirection: "row", gap: spacing.xs },
  headerButton: { flexDirection: "row", alignItems: "center", gap: 4, height: 34, paddingHorizontal: spacing.xs, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  headerButtonText: { ...typography.label, color: colors.terracotta, fontWeight: "700" },
  productBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.xs, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  productImage: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.creamSecondary },
  productLabel: { ...typography.label, color: colors.textSecondary },
  productTitle: { ...typography.medium, color: colors.charcoal },
  chat: { paddingVertical: spacing.md, gap: spacing.xs },
  intro: { alignItems: "center", paddingHorizontal: spacing.md, marginBottom: spacing.md },
  introIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.creamSecondary, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  introTitle: { ...typography.medium, color: colors.charcoal, textAlign: "center" },
  introText: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  suggestions: { gap: spacing.xs, marginTop: spacing.xs, marginBottom: spacing.sm },
  suggestion: { alignSelf: "flex-start", maxWidth: "92%", borderRadius: radius.full, borderWidth: 1, borderColor: colors.terracotta, backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  suggestionMuted: { borderColor: colors.border },
  suggestionText: { ...typography.caption, color: colors.terracotta, fontWeight: "700" },
  suggestionTextMuted: { color: colors.textSecondary, fontWeight: "600" },
  pressed: { opacity: 0.82 },
  cards: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.md },
  card: { width: 150, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.xs },
  cardImage: { width: "100%", height: 96, borderRadius: radius.sm, backgroundColor: colors.creamSecondary },
  cardTitle: { ...typography.caption, color: colors.charcoal, fontWeight: "700", marginTop: spacing.xs },
  cardPrice: { ...typography.caption, color: colors.terracotta, fontWeight: "700", marginTop: 2 },
  cardMeta: { ...typography.label, color: colors.textSecondary, marginTop: 2 },
  thinking: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs },
  thinkingText: { ...typography.caption, color: colors.textSecondary },
  composer: { flexDirection: "row", gap: spacing.xs, alignItems: "center", paddingVertical: spacing.sm },
  input: { flex: 1, minHeight: 48, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, color: colors.charcoal },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.terracotta, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
});
