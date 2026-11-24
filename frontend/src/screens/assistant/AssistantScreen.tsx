import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppIcon } from "../../components/AppIcon";
import { ErrorMessage, ScreenContainer } from "../../components/core";
import { MessageBubble, ProductImage } from "../../components/marketplace";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";
import { AssistantTurn, Product } from "../../types";
import { messageTime } from "../../utils/format";

/** A chat turn plus, for answers, the listings it talks about (shown as cards). */
type Turn = AssistantTurn & { at: string; products?: Product[] };

const MAX_LENGTH = 1000;

const GENERAL_QUESTIONS = ["What phones are for sale?", "Anything under LKR 15,000?", "How does reserving an item work?", "How do I pay safely?"];
const PRODUCT_QUESTIONS = ["Does it have any defects?", "What comes with it?", "Is delivery available?", "How do I reserve it?"];

/** The models sometimes add markdown; the chat shows plain text. */
const plain = (text: string) => text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/^\s*[-*]\s+/gm, "• ");

/**
 * The AgainBuy assistant: answers questions about the app and, when opened from
 * a product page (route param productId), about that listing. The chat lives
 * only on this screen; leaving it starts a fresh one next time.
 */
export function AssistantScreen({ navigation, route }: { navigation: any; route: any }) {
  const productId: string | undefined = route.params?.productId;
  const { data: product } = useApiData(async () => productId ? api.product(productId) : null, [productId]);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [draft, setDraft] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scroll = React.useRef<ScrollView>(null);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || thinking) return;
    const asked: Turn[] = [...turns, { role: "user", content: text, at: new Date().toISOString() }];
    setTurns(asked);
    setDraft("");
    setError(null);
    setThinking(true);
    try {
      const { reply, products } = await api.askAssistant(asked.map(({ role, content }) => ({ role, content })), productId);
      setTurns([...asked, { role: "assistant", content: plain(reply), at: new Date().toISOString(), products }]);
    } catch (caught) {
      setError(errorMessage(caught));
      // Put the question back so it can be sent again.
      setTurns(turns);
      setDraft(text);
    } finally {
      setThinking(false);
    }
  };

  const suggestions = productId ? PRODUCT_QUESTIONS : GENERAL_QUESTIONS;
  return <ScreenContainer scroll={false} keyboardAware contentStyle={styles.screen}>
    {product && <View style={styles.productBar}><ProductImage uri={product.image} style={styles.productImage}/><View style={styles.flex}><Text style={styles.productLabel}>Asking about</Text><Text numberOfLines={1} style={styles.productTitle}>{product.title}</Text></View></View>}
    <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.chat} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
      <View style={styles.intro}>
        <View style={styles.introIcon}><AppIcon name="sparkles-outline" size={22} color={colors.terracotta}/></View>
        <Text style={styles.introTitle}>Hi! I'm the AgainBuy assistant.</Text>
        <Text style={styles.introText}>{productId ? "Ask me about this item, or how to reserve, pay and arrange delivery." : "Ask me what's for sale, within your budget, or how to buy, sell and pay safely."} I can't see your orders, and I can make mistakes, so check important details with the seller.</Text>
      </View>
      {turns.length === 0 && <View style={styles.suggestions}>{suggestions.map((question) => <Pressable key={question} accessibilityRole="button" onPress={() => ask(question)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}><Text style={styles.suggestionText}>{question}</Text></Pressable>)}</View>}
      {turns.map((turn, index) => <React.Fragment key={index}>
        <MessageBubble text={turn.content} mine={turn.role === "user"} time={messageTime(turn.at)}/>
        {turn.products && turn.products.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>{turn.products.map((product) => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`Open ${product.title}, LKR ${product.price.toLocaleString()}`} onPress={() => navigation.navigate("ProductDetail", { id: product.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <ProductImage uri={product.image} style={styles.cardImage}/>
          <Text numberOfLines={2} style={styles.cardTitle}>{product.title}</Text>
          <Text style={styles.cardPrice}>LKR {product.price.toLocaleString()}</Text>
          <Text numberOfLines={1} style={styles.cardMeta}>{product.condition} · {product.location}</Text>
        </Pressable>)}</ScrollView>}
      </React.Fragment>)}
      {thinking && <View style={styles.thinking}><ActivityIndicator size="small" color={colors.terracotta}/><Text style={styles.thinkingText}>Thinking…</Text></View>}
      {error && <ErrorMessage message={error}/>}
    </ScrollView>
    <View style={styles.composer}>
      <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => ask(draft)} maxLength={MAX_LENGTH} placeholder="Ask a question…" placeholderTextColor={colors.textSecondary} style={styles.input} editable={!thinking}/>
      <Pressable accessibilityRole="button" accessibilityLabel="Ask" disabled={thinking || !draft.trim()} onPress={() => ask(draft)} style={[styles.send, (thinking || !draft.trim()) && styles.disabled]}><AppIcon name="send" size={19} color={colors.white}/></Pressable>
    </View>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.md },
  flex: { flex: 1 },
  productBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.xs, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  productImage: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.creamSecondary },
  productLabel: { ...typography.label, color: colors.textSecondary },
  productTitle: { ...typography.medium, color: colors.charcoal },
  chat: { paddingVertical: spacing.md, gap: spacing.xs },
  intro: { alignItems: "center", paddingHorizontal: spacing.md, marginBottom: spacing.md },
  introIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.creamSecondary, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  introTitle: { ...typography.medium, color: colors.charcoal, textAlign: "center" },
  introText: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  suggestions: { gap: spacing.xs, marginBottom: spacing.md },
  suggestion: { alignSelf: "flex-start", borderRadius: radius.full, borderWidth: 1, borderColor: colors.terracotta, backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  suggestionText: { ...typography.caption, color: colors.terracotta, fontWeight: "700" },
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
