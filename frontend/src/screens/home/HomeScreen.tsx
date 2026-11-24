import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { ErrorMessage, LoadingIndicator, PrimaryButton, ScreenContainer, SearchBar, SectionHeader } from "../../components/core";
import { ProductCard } from "../../components/marketplace";
import { useApp } from "../../context/AppContext";
import { useApiData } from "../../hooks/useApiData";
import { api } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";

const categoryIcons: Record<string, AppIconName> = { Phones: "phone-portrait-outline", Laptops: "laptop-outline", Furniture: "bed-outline", Electronics: "headset-outline", Books: "book-outline", Clothing: "shirt-outline", Sports: "football-outline", Appliances: "home-outline" };

export function HomeScreen({ navigation }: { navigation: any }) {
  const { wishlist, toggleWishlist } = useApp();
  const [showAllCategories, setShowAllCategories] = React.useState(false);
  const { data: categories = [] } = useApiData(() => api.categories());
  const { data: recent, error, loading } = useApiData(() => api.products({ pageSize: 4 }));
  const { data: affordable } = useApiData(() => api.products({ maxPrice: 49999, pageSize: 3 }));
  const open = (id: string) => navigation.navigate("ProductDetail", { id });
  return <ScreenContainer><Text style={styles.kicker}>GIVE GOOD THINGS A SECOND LIFE</Text><Text style={styles.hero}>Find something worth keeping.</Text><Text style={styles.heroBody}>Pre-loved products, honest condition details, and local sellers.</Text><SearchBar placeholder="What are you looking for?" onFilter={() => navigation.navigate("Explore")} /><View style={styles.sellBanner}><View style={styles.sellCopy}><Text style={styles.sellLabel}>READY TO LET SOMETHING GO?</Text><Text style={styles.sellTitle}>Turn unused things into someone’s next find.</Text><PrimaryButton title="Sell an item" onPress={() => navigation.navigate("Sell")} icon={<AppIcon name="add-circle-outline" size={19} color={colors.white}/>} style={styles.sellButton}/></View><View style={styles.reuseIcon}><AppIcon name="leaf-outline" size={39} color={colors.green}/></View></View><SectionHeader title="Browse categories" action={showAllCategories ? "Show less" : "See all"} onAction={() => setShowAllCategories((value) => !value)}/>{showAllCategories ? <View style={styles.categoryGrid}>{categories.map(({ name: category }) => <Pressable key={category} accessibilityRole="button" onPress={() => navigation.navigate("Explore", { category })} style={[styles.category, styles.categoryCell]}><View style={styles.categoryIcon}><AppIcon name={categoryIcons[category] ?? "grid-outline"} size={23} color={colors.terracotta}/></View><Text style={styles.categoryText}>{category}</Text></Pressable>)}</View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{categories.map(({ name: category }) => <Pressable key={category} accessibilityRole="button" onPress={() => navigation.navigate("Explore", { category })} style={styles.category}><View style={styles.categoryIcon}><AppIcon name={categoryIcons[category] ?? "grid-outline"} size={23} color={colors.terracotta}/></View><Text style={styles.categoryText}>{category}</Text></Pressable>)}</ScrollView>}<SectionHeader title="Recently listed" subtitle="Fresh finds near you" action="View all" onAction={() => navigation.navigate("Explore", { category: "All" })}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.products}>{error && <ErrorMessage message={error}/>}{loading && !recent && <LoadingIndicator/>}{recent?.items.map((product) => <ProductCard key={product.id} wide product={product} wished={wishlist.includes(product.id)} onPress={() => open(product.id)} onWishlist={() => toggleWishlist(product.id)}/>)}</ScrollView><SectionHeader title="Affordable favourites" subtitle="Good value under LKR 50,000"/><View style={styles.affordable}>{affordable?.items.map((product) => <ProductCard key={product.id} product={product} wide wished={wishlist.includes(product.id)} onPress={() => open(product.id)} onWishlist={() => toggleWishlist(product.id)}/>)}</View><View style={styles.promise}><AppIcon name="leaf" size={22} color={colors.green}/><View style={styles.promiseCopy}><Text style={styles.promiseTitle}>Buy thoughtfully. Sell honestly.</Text><Text style={styles.promiseText}>AgainBuy helps useful products stay useful for longer.</Text></View></View></ScreenContainer>;
}

const styles = StyleSheet.create({
  kicker: { ...typography.label, color: colors.green, letterSpacing: 1.1 },
  hero: { ...typography.display, color: colors.charcoal, marginTop: spacing.xs, maxWidth: 330 },
  heroBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
  sellBanner: { marginTop: spacing.md, borderRadius: radius.lg, backgroundColor: colors.charcoal, padding: spacing.lg, flexDirection: "row", overflow: "hidden" },
  sellCopy: { flex: 1 },
  sellLabel: { ...typography.label, color: colors.creamSecondary },
  sellTitle: { ...typography.title, color: colors.white, marginTop: spacing.xs },
  sellButton: { alignSelf: "flex-start", minHeight: 42, marginTop: spacing.md },
  reuseIcon: { width: 72, height: 72, borderRadius: 28, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
  categories: { gap: spacing.sm, paddingRight: spacing.md },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.md },
  categoryCell: { width: "25%" },
  category: { width: 78, alignItems: "center", gap: spacing.xs },
  categoryIcon: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  categoryText: { ...typography.label, color: colors.charcoal, textAlign: "center" },
  products: { gap: spacing.sm, paddingRight: spacing.md, paddingBottom: spacing.xs },
  affordable: { gap: spacing.sm },
  promise: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.greenSoft, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg },
  promiseCopy: { flex: 1 },
  promiseTitle: { ...typography.medium, color: colors.green },
  promiseText: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
