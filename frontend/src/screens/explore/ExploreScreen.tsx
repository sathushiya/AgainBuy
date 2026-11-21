import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState, ErrorMessage, FilterChip, LoadingIndicator, SearchBar } from "../../components/core";
import { ProductGrid } from "../../components/marketplace";
import { useApp } from "../../context/AppContext";
import { useApiData } from "../../hooks/useApiData";
import { api } from "../../services/api";
import { colors, spacing, typography } from "../../theme";

const CONDITIONS = ["Any condition", "Like new", "Excellent", "Good", "Fair"];

export function ExploreScreen({ navigation, route }: { navigation: any; route: any }) {
  const { wishlist, toggleWishlist } = useApp();
  const [query, setQuery] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState(route.params?.category ?? "All");
  const [condition, setCondition] = React.useState("Any condition");

  // Home sends the category to show ("All" for View all). Re-apply it on every
  // navigation, even if the value is unchanged, since this tab keeps its state.
  React.useEffect(() => { if (route.params?.category) setCategory(route.params.category); }, [route.params]);

  // Wait for a pause in typing before asking the server.
  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: categories = [] } = useApiData(() => api.categories());
  const { data, error, loading } = useApiData(
    () => api.products({ search, category: category === "All" ? undefined : category, condition: condition === "Any condition" ? undefined : condition, pageSize: 50 }),
    [search, category, condition],
  );
  const products = data?.items ?? [];
  // Each tap moves to the next condition, then wraps back to "Any condition".
  const toggleCondition = () => setCondition((value) => CONDITIONS[(CONDITIONS.indexOf(value) + 1) % CONDITIONS.length]!);

  return <View style={styles.screen}><View style={styles.header}><Text style={styles.title}>Explore</Text><Text style={styles.subtitle}>Search honest listings from local sellers</Text><SearchBar value={query} onChangeText={setQuery} onFilter={toggleCondition}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{["All", ...categories.map((item) => item.name)].map((item) => <FilterChip key={item} label={item} selected={category === item} onPress={() => setCategory(item)}/>)}</ScrollView><View style={styles.resultRow}><Text style={styles.results}>{data ? `${data.total} products` : " "}</Text><FilterChip label={condition} selected={condition !== "Any condition"} onPress={toggleCondition}/></View>{error && <ErrorMessage message={error}/>}</View>{loading && !data ? <LoadingIndicator/> : <ProductGrid data={products} wishlist={wishlist} onWishlist={toggleWishlist} onProduct={(product) => navigation.navigate("ProductDetail", { id: product.id })} ListEmptyComponent={<EmptyState icon="search-outline" title="No products found" message="Try another search, category, or condition." action="Clear filters" onAction={() => { setQuery(""); setCategory("All"); setCondition("Any condition"); }}/>}/>}</View>;
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
