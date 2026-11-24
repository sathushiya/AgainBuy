import { useState } from "react";
import { FlatList, Image, ImageStyle, Modal, Pressable, StyleProp, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing, typography } from "../theme";
import { Conversation, Product, Transaction } from "../types";
import { ConditionBadge, PriceLabel, StatusBadge } from "./core";
import { AppIcon } from "./AppIcon";
import { formatDate, messageTime, timeAgo } from "../utils/format";

/** Product photo, or a neutral placeholder for listings published without one. */
export function ProductImage({ uri, style, label }: { uri: string; style: StyleProp<ImageStyle>; label?: string }) {
  if (uri) return <Image source={{ uri }} style={style} accessibilityLabel={label}/>;
  return <View style={[style as object, styles.placeholder]} accessibilityLabel={label}><AppIcon name="camera-outline" size={30} color={colors.textSecondary}/></View>;
}

export function WishlistButton({ active, onPress, floating = false }: { active: boolean; onPress: () => void; floating?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={active ? "Remove from wishlist" : "Add to wishlist"} onPress={onPress} style={({ pressed }) => [styles.wishlist, floating && styles.wishlistFloating, pressed && styles.pressed]}><AppIcon name={active ? "heart" : "heart-outline"} size={20} color={active ? colors.terracotta : colors.charcoal} fill={active ? colors.terracotta : "none"}/></Pressable>;
}

export function ProductCard({ product, wished, onPress, onWishlist, wide }: { product: Product; wished: boolean; onPress: () => void; onWishlist: () => void; wide?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${product.title}`} onPress={onPress} style={({ pressed }) => [styles.card, wide && styles.cardWide, pressed && styles.pressed]}><View><ProductImage uri={product.image} style={[styles.image, wide && styles.imageWide]} label={`${product.title} product photo`}/><WishlistButton active={wished} onPress={onWishlist} floating/></View><View style={styles.content}><ConditionBadge condition={product.condition}/><Text numberOfLines={1} style={styles.title}>{product.title}</Text><PriceLabel price={product.price} compact/><Text numberOfLines={1} style={styles.meta}>{product.usage} · {product.location}</Text><Text style={styles.listed}>{timeAgo(product.listedAt)}</Text></View></Pressable>;
}

export function ProductGrid({ data, wishlist, onProduct, onWishlist, ListEmptyComponent }: { data: Product[]; wishlist: string[]; onProduct: (product: Product) => void; onWishlist: (id: string) => void; ListEmptyComponent?: React.ReactElement }) {
  return <FlatList data={data} keyExtractor={(item) => item.id} numColumns={2} columnWrapperStyle={styles.columns} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false} ListEmptyComponent={ListEmptyComponent} renderItem={({ item }) => <ProductCard product={item} wished={wishlist.includes(item.id)} onPress={() => onProduct(item)} onWishlist={() => onWishlist(item.id)}/>}/>;
}

export function ConversationCard({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.conversation, pressed && styles.pressed]}><Image source={{ uri: conversation.avatar }} style={styles.avatar}/><View style={styles.conversationCopy}><View style={styles.row}><Text style={styles.conversationName}>{conversation.person}</Text><Text style={styles.time}>{messageTime(conversation.time)}</Text></View><Text numberOfLines={1} style={styles.productName}>{conversation.productTitle}</Text><Text numberOfLines={1} style={styles.message}>{conversation.lastMessage}</Text></View>{conversation.unread > 0 && <View style={styles.unread}><Text style={styles.unreadText}>{conversation.unread}</Text></View>}</Pressable>;
}

/** A chat message: text, a photo (tap to view full screen), or a photo with a caption. */
export function MessageBubble({ text, image, mine, time }: { text: string; image?: string | null; mine?: boolean; time: string }) {
  const [viewing, setViewing] = useState(false);
  return <View style={[styles.bubbleWrap, mine && styles.bubbleWrapMine]}><View style={[styles.bubble, mine && styles.bubbleMine, !!image && styles.bubblePhoto]}>{image && <Pressable accessibilityRole="imagebutton" accessibilityLabel="Open photo" onPress={() => setViewing(true)}><Image source={{ uri: image }} style={styles.messagePhoto}/></Pressable>}{!!text && <Text style={[styles.bubbleText, mine && styles.bubbleTextMine, !!image && styles.photoCaption]}>{text}</Text>}</View><Text style={styles.bubbleTime}>{time}</Text>{image && <Modal visible={viewing} transparent animationType="fade" onRequestClose={() => setViewing(false)}><Pressable accessibilityRole="button" accessibilityLabel="Close photo" onPress={() => setViewing(false)} style={styles.photoViewer}><Image source={{ uri: image }} style={styles.photoFull} resizeMode="contain"/></Pressable></Modal>}</View>;
}

export function TransactionCard({ transaction, onPress, children }: React.PropsWithChildren<{ transaction: Transaction; onPress?: () => void }>) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.transaction, pressed && styles.pressed]}><ProductImage uri={transaction.productImage} style={styles.transactionImage}/><View style={styles.transactionCopy}><View style={styles.row}><Text style={styles.transactionId}>{transaction.id}</Text><StatusBadge status={transaction.status}/></View><Text numberOfLines={1} style={styles.conversationName}>{transaction.productTitle}</Text><Text style={styles.message}>{transaction.type === "purchase" ? "Seller" : "Buyer"}: {transaction.party} · {formatDate(transaction.date)}</Text><PriceLabel price={transaction.amount} compact/>{children}</View></Pressable>;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.82 },
  placeholder: { backgroundColor: colors.creamSecondary, alignItems: "center", justifyContent: "center" },
  wishlist: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  wishlistFloating: { position: "absolute", top: 9, right: 9, width: 36, height: 36, borderWidth: 0 },
  card: { width: "48.3%", borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  cardWide: { width: 246 },
  image: { width: "100%", height: 158, backgroundColor: colors.creamSecondary },
  imageWide: { height: 150 },
  content: { padding: spacing.sm },
  title: { ...typography.medium, color: colors.charcoal, marginTop: spacing.xs },
  meta: { ...typography.label, color: colors.textSecondary, marginTop: spacing.xs },
  listed: { ...typography.label, fontSize: 9, color: colors.textSecondary, marginTop: 3 },
  columns: { justifyContent: "space-between", marginBottom: spacing.sm },
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 110 },
  conversation: { minHeight: 86, flexDirection: "row", gap: spacing.sm, alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.cream },
  avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.creamSecondary },
  conversationCopy: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
  conversationName: { ...typography.medium, color: colors.charcoal, flex: 1 },
  time: { ...typography.label, color: colors.textSecondary },
  productName: { ...typography.label, color: colors.terracotta, marginTop: 2 },
  message: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  unread: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.terracotta },
  unreadText: { ...typography.label, color: colors.white },
  bubbleWrap: { alignSelf: "flex-start", maxWidth: "80%", marginBottom: spacing.sm },
  bubbleWrapMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { borderRadius: radius.lg, borderBottomLeftRadius: 5, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.terracotta, borderColor: colors.terracotta, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: 5 },
  bubbleText: { ...typography.body, color: colors.charcoal },
  bubbleTextMine: { color: colors.white },
  bubbleTime: { ...typography.label, fontSize: 9, color: colors.textSecondary, marginTop: 3 },
  bubblePhoto: { padding: 4 },
  messagePhoto: { width: 220, height: 220, borderRadius: radius.md, backgroundColor: colors.creamSecondary },
  photoCaption: { paddingHorizontal: spacing.xs, paddingTop: spacing.xs, paddingBottom: 2, maxWidth: 220 },
  photoViewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: spacing.md },
  photoFull: { width: "100%", height: "100%" },
  transaction: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.sm },
  transactionImage: { width: 86, height: 104, borderRadius: radius.md, backgroundColor: colors.creamSecondary },
  transactionCopy: { flex: 1, justifyContent: "center", gap: 3 },
  transactionId: { ...typography.label, color: colors.terracotta },
});
