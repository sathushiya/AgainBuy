import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../components/AppIcon";
import { EmptyState, ErrorMessage, LoadingIndicator, ScreenContainer, SectionHeader, StatusBadge } from "../../components/core";
import { ProductCard, ProductGrid } from "../../components/marketplace";
import { useApp } from "../../context/AppContext";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";

export function WishlistScreen({ navigation }: { navigation: any }) {
  const { wishlist, toggleWishlist } = useApp();
  const { data = [], error, loading } = useApiData(() => api.wishlist());
  // Hide items un-hearted on this screen without waiting for a reload.
  const items = data.filter((item) => wishlist.includes(item.id));
  return <View style={styles.listScreen}><View style={styles.listHeader}><Text style={styles.pageTitle}>Wishlist</Text><Text style={styles.meta}>Saved products to revisit later</Text>{error && <ErrorMessage message={error}/>}</View>{loading && data.length === 0 ? <LoadingIndicator/> : <ProductGrid data={items} wishlist={wishlist} onWishlist={toggleWishlist} onProduct={(item) => navigation.navigate("ProductDetail", { id: item.id })} ListEmptyComponent={<EmptyState icon="heart-outline" title="Your wishlist is empty" message="Save products you want to compare or revisit." action="Explore products" onAction={() => navigation.navigate("CustomerTabs", { screen: "Explore" })}/>}/>}</View>;
}

export function MyListingsScreen({ navigation }: { navigation: any }) {
  const { wishlist, toggleWishlist } = useApp();
  const { data: listings = [], error, loading, setData } = useApiData(() => api.myListings());
  const [actionError, setActionError] = React.useState<string | null>(null);

  const toggleActive = async (id: string, activate: boolean) => {
    try {
      const updated = await (activate ? api.activateListing(id) : api.deactivateListing(id));
      setData(listings.map((item) => item.id === id ? updated : item));
      setActionError(null);
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  return <ScreenContainer><Text style={styles.pageTitle}>My Listings</Text><Text style={styles.meta}>Manage everything you’re selling</Text>{(error || actionError) && <ErrorMessage message={(actionError ?? error)!}/>}{loading && listings.length === 0 ? <LoadingIndicator/> : listings.length === 0 ? <EmptyState title="No listings yet" message="Sell something you no longer use." action="Sell an item" onAction={() => navigation.navigate("CustomerTabs", { screen: "Sell" })}/> : listings.map((item) => <View key={item.id} style={styles.listing}><ProductCard product={item} wide wished={wishlist.includes(item.id)} onPress={() => navigation.navigate("ProductDetail", { id: item.id })} onWishlist={() => toggleWishlist(item.id)}/><View style={styles.listingFooter}><StatusBadge status={item.status}/>{item.status === "Active" || item.status === "Reserved" ? <Pressable onPress={() => toggleActive(item.id, false)}><Text style={styles.deactivate}>Deactivate</Text></Pressable> : item.status === "Inactive" ? <Pressable onPress={() => toggleActive(item.id, true)}><Text style={styles.reactivate}>Reactivate</Text></Pressable> : null}</View></View>)}</ScreenContainer>;
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
  reactivate: { ...typography.caption, color: colors.green, fontWeight: "700" },
  setting: { minHeight: 56, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.xs, flexDirection: "row", alignItems: "center" },
  help: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.greenSoft, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg },
  flex: { flex: 1 },
  helpTitle: { ...typography.medium, color: colors.green },
  helpText: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
