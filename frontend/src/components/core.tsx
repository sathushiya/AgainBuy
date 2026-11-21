import { PropsWithChildren, ReactNode, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, shadows, spacing, typography } from "../theme";
import { ProductCondition } from "../types";
import { AgainBuyLogo } from "./AgainBuyLogo";
import { AppIcon, AppIconName } from "./AppIcon";

export function ScreenContainer({ children, scroll = true, keyboardAware = false, contentStyle }: PropsWithChildren<{ scroll?: boolean; keyboardAware?: boolean; contentStyle?: StyleProp<ViewStyle> }>) {
  const content = scroll ? <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.screenContent, contentStyle]}>{children}</ScrollView> : <View style={[styles.flex, contentStyle]}>{children}</View>;
  return <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>{keyboardAware ? <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>{content}</KeyboardAvoidingView> : content}</SafeAreaView>;
}

export function AppHeader({ title, subtitle, onNotifications, brand = false }: { title?: string; subtitle?: string; onNotifications?: () => void; brand?: boolean }) {
  return <View style={styles.header}>{brand ? <AgainBuyLogo width={142}/> : <View style={styles.flex}>{title && <Text style={styles.headerTitle}>{title}</Text>}{subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}</View>}{onNotifications && <IconButton icon="notifications-outline" label="Open notifications" onPress={onNotifications} badge/>}</View>;
}

export function PrimaryButton({ title, onPress, disabled, loading, icon, style }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.primary, style, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={colors.white}/> : <>{icon}<Text style={styles.primaryText}>{title}</Text></>}</Pressable>;
}

export function SecondaryButton({ title, onPress, icon, style, destructive }: { title: string; onPress: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle>; destructive?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.secondary, style, destructive && styles.destructiveSoft, pressed && styles.pressed]}>{icon}<Text style={[styles.secondaryText, destructive && styles.destructiveText]}>{title}</Text></Pressable>;
}

export function IconButton({ icon, label, onPress, badge }: { icon: AppIconName; label: string; onPress: () => void; badge?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><AppIcon name={icon} size={21} color={colors.charcoal}/>{badge && <View style={styles.notificationDot}/>}</Pressable>;
}

export function AppTextInput({ label, error, multiline, rightElement, ...props }: TextInputProps & { label: string; error?: string; rightElement?: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>{label}</Text><View><TextInput placeholderTextColor={colors.textSecondary} multiline={multiline} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.field, rightElement ? styles.fieldWithRight : undefined, multiline && styles.multiline, focused && styles.fieldFocused, !!error && styles.fieldError]} {...props}/>{rightElement && <View style={styles.fieldRight}>{rightElement}</View>}</View>{error && <ErrorMessage message={error}/>}</View>;
}

export function SearchBar({ value, onChangeText, onFilter, placeholder = "Search pre-loved products" }: { value?: string; onChangeText?: (value: string) => void; onFilter?: () => void; placeholder?: string }) {
  return <View style={styles.search}><AppIcon name="search-outline" size={21} color={colors.textSecondary}/><TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textSecondary} style={styles.searchInput}/>{onFilter && <Pressable accessibilityRole="button" accessibilityLabel="Open filters" onPress={onFilter} style={styles.filterButton}><AppIcon name="options-outline" size={20} color={colors.terracotta}/></Pressable>}</View>;
}

export function SectionHeader({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>{title}</Text>{subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}</View>{action && <Pressable accessibilityRole="button" onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable>}</View>;
}

export function FilterChip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>;
}

export const CategoryChip = FilterChip;

export function ConditionBadge({ condition }: { condition: ProductCondition }) {
  const excellent = condition === "Like new" || condition === "Excellent";
  return <View style={[styles.condition, excellent && styles.conditionGreen]}><View style={[styles.conditionDot, excellent && styles.conditionDotGreen]}/><Text style={[styles.conditionText, excellent && styles.conditionTextGreen]}>{condition}</Text></View>;
}

export function StatusBadge({ status }: { status: string }) {
  const success = ["Active", "Completed", "Sold"].includes(status);
  const warning = ["Reserved", "Meetup scheduled"].includes(status);
  return <View style={[styles.status, success && styles.statusSuccess, warning && styles.statusWarning]}><Text style={[styles.statusText, success && styles.statusTextSuccess, warning && styles.statusTextWarning]}>{status}</Text></View>;
}

export function PriceLabel({ price, original, compact }: { price: number; original?: number; compact?: boolean }) {
  return <View style={styles.priceRow}><Text style={[styles.price, compact && styles.priceCompact]}>LKR {price.toLocaleString()}</Text>{original && <Text style={styles.originalPrice}>LKR {original.toLocaleString()}</Text>}</View>;
}

export function EmptyState({ icon = "leaf-outline", title, message, action, onAction }: { icon?: AppIconName; title: string; message: string; action?: string; onAction?: () => void }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><AppIcon name={icon} size={32} color={colors.green}/></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{message}</Text>{action && onAction && <SecondaryButton title={action} onPress={onAction}/>}</View>;
}

export function LoadingIndicator({ label = "Loading…" }: { label?: string }) {
  return <View style={styles.loading}><ActivityIndicator size="large" color={colors.terracotta}/><Text style={styles.loadingText}>{label}</Text></View>;
}

export function ErrorMessage({ message }: { message: string }) {
  return <View accessibilityRole="alert" style={styles.errorMessage}><AppIcon name="alert-circle-outline" size={15} color={colors.error}/><Text style={styles.errorText}>{message}</Text></View>;
}

export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel, destructive }: { visible: boolean; title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; destructive?: boolean }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}><Pressable style={styles.overlay} onPress={onCancel}><Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}><View style={styles.dialogIcon}><AppIcon name={destructive ? "log-out-outline" : "checkmark-circle-outline"} size={27} color={destructive ? colors.error : colors.green}/></View><Text style={styles.dialogTitle}>{title}</Text><Text style={styles.dialogText}>{message}</Text><View style={styles.dialogActions}><SecondaryButton title="Cancel" onPress={onCancel} style={styles.flex}/><PrimaryButton title={confirmLabel} onPress={onConfirm} style={[styles.flex, destructive && styles.destructive]}/></View></Pressable></Pressable></Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  screenContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 110 },
  header: { minHeight: 55, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.md },
  headerTitle: { ...typography.heading, color: colors.charcoal },
  headerSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  iconButton: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  notificationDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.terracotta, borderWidth: 2, borderColor: colors.white },
  primary: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.terracotta, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  primaryText: { ...typography.medium, color: colors.white },
  secondary: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  secondaryText: { ...typography.medium, color: colors.charcoal },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  destructive: { backgroundColor: colors.error },
  destructiveSoft: { backgroundColor: colors.creamSecondary, borderColor: colors.error },
  destructiveText: { color: colors.error },
  fieldGroup: { gap: 7 },
  fieldLabel: { ...typography.caption, color: colors.charcoal, fontWeight: "700" },
  field: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.sm, color: colors.charcoal, ...typography.body },
  fieldWithRight: { paddingRight: 52 },
  fieldRight: { position: "absolute", right: spacing.sm, top: 0, bottom: 0, justifyContent: "center" },
  multiline: { minHeight: 104, textAlignVertical: "top", paddingTop: spacing.sm },
  fieldFocused: { borderColor: colors.terracotta, borderWidth: 1.5 },
  fieldError: { borderColor: colors.error },
  search: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingLeft: spacing.sm, paddingRight: 7, flexDirection: "row", alignItems: "center", gap: spacing.xs, ...shadows.card },
  searchInput: { flex: 1, color: colors.charcoal, ...typography.body },
  filterButton: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.terracottaSoft, alignItems: "center", justifyContent: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { ...typography.title, color: colors.charcoal },
  sectionSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  sectionAction: { ...typography.caption, color: colors.terracotta, fontWeight: "700" },
  chip: { minHeight: 38, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center" },
  chipSelected: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.white },
  condition: { alignSelf: "flex-start", minHeight: 25, borderRadius: radius.full, backgroundColor: colors.terracottaSoft, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  conditionGreen: { backgroundColor: colors.greenSoft },
  conditionDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.terracotta },
  conditionDotGreen: { backgroundColor: colors.green },
  conditionText: { ...typography.label, fontSize: 10, color: colors.terracottaDark },
  conditionTextGreen: { color: colors.green },
  status: { alignSelf: "flex-start", borderRadius: radius.full, backgroundColor: colors.creamSecondary, paddingHorizontal: 9, paddingVertical: 6 },
  statusSuccess: { backgroundColor: colors.greenSoft },
  statusWarning: { backgroundColor: colors.creamSecondary },
  statusText: { ...typography.label, fontSize: 10, color: colors.textSecondary },
  statusTextSuccess: { color: colors.green },
  statusTextWarning: { color: colors.warning },
  priceRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs },
  price: { ...typography.title, color: colors.terracotta },
  priceCompact: { ...typography.medium },
  originalPrice: { ...typography.caption, color: colors.textSecondary, textDecorationLine: "line-through" },
  empty: { minHeight: 330, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  emptyIcon: { width: 70, height: 70, borderRadius: radius.lg, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  emptyTitle: { ...typography.title, color: colors.charcoal, marginTop: spacing.md },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginVertical: spacing.xs },
  loading: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  loadingText: { ...typography.caption, color: colors.textSecondary },
  errorMessage: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  errorText: { ...typography.caption, color: colors.error, flex: 1 },
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  dialog: { width: "100%", maxWidth: 380, borderRadius: radius.xl, backgroundColor: colors.cream, padding: spacing.lg, ...shadows.card },
  dialogIcon: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  dialogTitle: { ...typography.title, color: colors.charcoal, marginTop: spacing.md },
  dialogText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  dialogActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
});
