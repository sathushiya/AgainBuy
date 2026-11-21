import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog, EmptyState, ErrorMessage, LoadingIndicator, ScreenContainer } from "../../components/core";
import { TransactionCard } from "../../components/marketplace";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, spacing, typography } from "../../theme";
import { Transaction } from "../../types";

export function TransactionScreen({ type }: { type: "purchase" | "sale" }) {
  const { data: items = [], error, loading, reload } = useApiData(() => api.transactions(type), [type]);
  const [action, setAction] = React.useState<{ transaction: Transaction; kind: "complete" | "cancel" } | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const settle = async () => {
    if (!action) return;
    const { transaction, kind } = action;
    setAction(null);
    try {
      await (kind === "complete" ? api.completeTransaction(transaction.id) : api.cancelTransaction(transaction.id));
      setActionError(null);
      await reload();
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  return <ScreenContainer><Text style={styles.title}>My {type === "purchase" ? "Purchases" : "Sales"}</Text><Text style={styles.subtitle}>{type === "purchase" ? "Products you’ve found and bought" : "Products you’ve passed on to someone new"}</Text>{(error || actionError) && <ErrorMessage message={(actionError ?? error)!}/>}<View style={styles.list}>{loading && items.length === 0 ? <LoadingIndicator/> : items.length ? items.map((item) => <TransactionCard key={item.id} transaction={item}>{item.status === "Meetup scheduled" && <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => setAction({ transaction: item, kind: "complete" })}><Text style={styles.complete}>Mark completed</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setAction({ transaction: item, kind: "cancel" })}><Text style={styles.cancel}>Cancel</Text></Pressable></View>}</TransactionCard>) : <EmptyState title={`No ${type === "purchase" ? "purchases" : "sales"} yet`} message="Your transaction history will appear here."/>}</View><Text style={styles.note}>AgainBuy never handles payment. Pay in person after inspecting the item.</Text><ConfirmDialog visible={action !== null} destructive={action?.kind === "cancel"} title={action?.kind === "complete" ? "Mark this transaction completed?" : "Cancel this transaction?"} message={action?.kind === "complete" ? "Confirm the item was handed over. The listing will be marked as sold." : "The item will go back on the marketplace for other buyers."} confirmLabel={action?.kind === "complete" ? "Mark completed" : "Cancel transaction"} onCancel={() => setAction(null)} onConfirm={settle}/></ScreenContainer>;
}

export const PurchasesScreen = () => <TransactionScreen type="purchase"/>;
export const SalesScreen = () => <TransactionScreen type="sale"/>;

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.charcoal },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  list: { marginTop: spacing.lg },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  complete: { ...typography.caption, color: colors.green, fontWeight: "700" },
  cancel: { ...typography.caption, color: colors.error, fontWeight: "700" },
  note: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md },
});
