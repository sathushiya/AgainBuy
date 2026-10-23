import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState, FilterChip, SearchBar } from "../../components/core";
import { ProductGrid } from "../../components/marketplace";
import { useApp } from "../../context/AppContext";
import { categories, products } from "../../data/mockData";
import { colors, spacing, typography } from "../../theme";

export function ExploreScreen({ navigation, route }: { navigation: any; route: any }) {
  const { wishlist, toggleWishlist } = useApp();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState(route.params?.category ?? "All");
  const [condition, setCondition] = React.useState("Any condition");
  const filtered = useMemo(() => products.filter((product) => (category === "All" || product.category === category) && (condition === "Any condition" || product.condition === condition) && product.title.toLowerCase().includes(query.toLowerCase())), [query, category, condition]);
  return <View style={styles.screen}><View style={styles.header}><Text style={styles.title}>Explore</Text><Text style={styles.subtitle}>Search honest listings from local sellers</Text><SearchBar value={query} onChangeText={setQuery} onFilter={() => setCondition((value) => value === "Any condition" ? "Excellent" : "Any condition")}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{categories.map((item) => <FilterChip key={item} label={item} selected={category === item} onPress={() => setCategory(item)}/>)}</ScrollView><View style={styles.resultRow}><Text style={styles.results}>{filtered.length} products</Text><FilterChip label={condition} selected={condition !== "Any condition"} onPress={() => setCondition((value) => value === "Any condition" ? "Excellent" : "Any condition")}/></View></View><ProductGrid data={filtered} wishlist={wishlist} onWishlist={toggleWishlist} onProduct={(product) => navigation.navigate("ProductDetail", { id: product.id })} ListEmptyComponent={<EmptyState icon="search-outline" title="No products found" message="Try another search, category, or condition." action="Clear filters" onAction={() => { setQuery(""); setCategory("All"); setCondition("Any condition"); }}/>}/></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, paddingTop: spacing.xl },
  header: { paddingHorizontal: spacing.md },
  title: { ...typography.heading, color: colors.charcoal },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  filters: { gap: spacing.xs, paddingVertical: spacing.md, paddingRight: spacing.md },
  resultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  results: { ...typography.medium, color: colors.charcoal },
});
