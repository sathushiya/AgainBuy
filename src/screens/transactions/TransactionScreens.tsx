import { StyleSheet, Text, View } from "react-native";
import { EmptyState, ScreenContainer } from "../../components/core";
import { TransactionCard } from "../../components/marketplace";
import { products, transactions } from "../../data/mockData";
import { colors, spacing, typography } from "../../theme";

export function TransactionScreen({ type }: { type: "purchase" | "sale" }) {
  const items = transactions.filter((item) => item.type === type);
  return <ScreenContainer><Text style={styles.title}>My {type === "purchase" ? "Purchases" : "Sales"}</Text><Text style={styles.subtitle}>{type === "purchase" ? "Products you’ve found and bought" : "Products you’ve passed on to someone new"}</Text><View style={styles.list}>{items.length ? items.map((item) => <TransactionCard key={item.id} transaction={item} product={products.find((product) => product.id === item.productId)!}/>) : <EmptyState title={`No ${type === "purchase" ? "purchases" : "sales"} yet`} message="Your transaction history will appear here."/ >}</View><Text style={styles.note}>All transactions shown are sample data. No payments were processed.</Text></ScreenContainer>;
}

export const PurchasesScreen = () => <TransactionScreen type="purchase"/>;
export const SalesScreen = () => <TransactionScreen type="sale"/>;

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.charcoal },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  list: { marginTop: spacing.lg },
  note: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md },
});
