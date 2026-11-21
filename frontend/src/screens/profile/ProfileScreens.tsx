import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../components/AppIcon";
import { EmptyState, ScreenContainer, SectionHeader, StatusBadge } from "../../components/core";
import { ProductCard, ProductGrid } from "../../components/marketplace";
import { useApp } from "../../context/AppContext";
import { products } from "../../data/mockData";
import { colors, radius, spacing, typography } from "../../theme";

export function WishlistScreen({ navigation }: { navigation: any }) {
  const { wishlist, toggleWishlist } = useApp();
  const items = products.filter((item) => wishlist.includes(item.id));
  return <View style={styles.listScreen}><View style={styles.listHeader}><Text style={styles.pageTitle}>Wishlist</Text><Text style={styles.meta}>Saved products to revisit later</Text></View><ProductGrid data={items} wishlist={wishlist} onWishlist={toggleWishlist} onProduct={(item) => navigation.navigate("ProductDetail", { id: item.id })} ListEmptyComponent={<EmptyState icon="heart-outline" title="Your wishlist is empty" message="Save products you want to compare or revisit." action="Explore products" onAction={() => navigation.navigate("CustomerTabs", { screen: "Explore" })}/>}/></View>;
}

export function MyListingsScreen() {
  const { listings, wishlist, toggleWishlist, deactivateListing } = useApp();
  return <ScreenContainer><Text style={styles.pageTitle}>My Listings</Text><Text style={styles.meta}>Manage everything you’re selling</Text>{listings.length === 0 ? <EmptyState title="No listings yet" message="Sell something you no longer use."/> : listings.map((item) => <View key={item.id} style={styles.listing}><ProductCard product={item} wide wished={wishlist.includes(item.id)} onPress={() => {}} onWishlist={() => toggleWishlist(item.id)}/><View style={styles.listingFooter}><StatusBadge status={item.status}/><Pressable onPress={() => deactivateListing(item.id)}><Text style={styles.deactivate}>Deactivate</Text></Pressable></View></View>)}</ScreenContainer>;
}

export function SettingsScreen() {
  return <ScreenContainer><Text style={styles.pageTitle}>Settings & Help</Text><Text style={styles.meta}>Account preferences and marketplace support</Text><SectionHeader title="Account"/>{["Personal information","Notification preferences","Privacy and safety","Saved locations"].map((label) => <Setting key={label} label={label}/>)}<SectionHeader title="Support"/>{["Buying safely","Selling guidelines","Report a problem","Contact support"].map((label) => <Setting key={label} label={label}/>)}<View style={styles.help}><AppIcon name="shield-checkmark-outline" size={24} color={colors.green}/><View style={styles.flex}><Text style={styles.helpTitle}>Stay safe when meeting</Text><Text style={styles.helpText}>Meet in a public place, inspect the product, and never send advance payments to unknown sellers.</Text></View></View></ScreenContainer>;
}

function Setting({ label }: { label: string }) {
  return <Pressable accessibilityRole="button" style={styles.setting}><Text style={styles.menuLabel}>{label}</Text><AppIcon name="chevron-forward" size={18} color={colors.textSecondary}/></Pressable>;
}

const styles = StyleSheet.create({
  pageTitle: { ...typography.heading, color: colors.charcoal },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  menuLabel: { ...typography.medium, color: colors.charcoal, flex: 1 },
  listScreen: { flex: 1, backgroundColor: colors.cream, paddingTop: spacing.xl },
  listHeader: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  listing: { marginTop: spacing.md },
  listingFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  deactivate: { ...typography.caption, color: colors.error, fontWeight: "700" },
  setting: { minHeight: 56, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.xs, flexDirection: "row", alignItems: "center" },
  help: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.greenSoft, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg },
  flex: { flex: 1 },
  helpTitle: { ...typography.medium, color: colors.green },
  helpText: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
