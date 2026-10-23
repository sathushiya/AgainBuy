import React from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState, ScreenContainer, SearchBar } from "../../components/core";
import { AppIcon } from "../../components/AppIcon";
import { ConversationCard, MessageBubble } from "../../components/marketplace";
import { conversations, products } from "../../data/mockData";
import { colors, radius, spacing, typography } from "../../theme";

export function MessagesScreen({ navigation }: { navigation: any }) {
  const [query, setQuery] = React.useState("");
  const filtered = conversations.filter((item) => item.person.toLowerCase().includes(query.toLowerCase()));
  return <ScreenContainer scroll={false} contentStyle={styles.screen}><View style={styles.header}><Text style={styles.title}>Messages</Text><Text style={styles.subtitle}>Talk directly with buyers and sellers</Text><SearchBar value={query} onChangeText={setQuery} placeholder="Search conversations"/></View><FlatList data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="No conversations" message="Messages about products will appear here."/>} renderItem={({ item }) => <ConversationCard conversation={item} product={products.find((product) => product.id === item.productId)!} onPress={() => navigation.navigate("Conversation", { id: item.id })}/>}/></ScreenContainer>;
}

export function ConversationScreen({ route }: { route: any }) {
  const conversation = conversations.find((item) => item.id === route.params?.id) ?? conversations[0]!;
  const product = products.find((item) => item.id === conversation.productId)!;
  const [messages, setMessages] = React.useState(["Hi, is this still available?", conversation.lastMessage]);
  const [draft, setDraft] = React.useState("");
  return <ScreenContainer scroll={false} contentStyle={styles.conversationScreen}><View style={styles.productBar}><Image source={{ uri: product.image }} style={styles.productImage}/><View style={styles.flex}><Text numberOfLines={1} style={styles.productTitle}>{product.title}</Text><Text style={styles.productPrice}>LKR {product.price.toLocaleString()}</Text></View><AppIcon name="chevron-forward" size={18} color={colors.textSecondary}/></View><View style={styles.bubbles}><Text style={styles.safety}>Keep communication in AgainBuy and inspect before paying.</Text>{messages.map((message, index) => <MessageBubble key={`${message}-${index}`} text={message} mine={index % 2 === 0} time={index % 2 === 0 ? "9:36 AM" : "9:42 AM"}/>)}</View><View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder="Write a message…" placeholderTextColor={colors.textSecondary} style={styles.input}/><Pressable accessibilityRole="button" accessibilityLabel="Send message" onPress={() => { if (draft.trim()) { setMessages((items) => [...items, draft.trim()]); setDraft(""); } }} style={styles.send}><AppIcon name="send" size={19} color={colors.white}/></Pressable></View></ScreenContainer>;
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
});
