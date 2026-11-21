import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader, ConfirmDialog, EmptyState, ScreenContainer, SearchBar, SectionHeader, StatusBadge } from "../../components/core";
import { AppIcon } from "../../components/AppIcon";
import { DashboardStatCard, FacilityCard, UserManagementCard } from "../../components/roles";
import { useApp } from "../../context/AppContext";
import { products } from "../../data/mockData";
import { facilities, moderationQueue, platformUsers } from "../../data/mockOperations";
import { colors, radius, spacing, typography } from "../../theme";

export function AdminDashboard({ navigation }: { navigation: any }) {
  const { user, hasPermission } = useApp();
  if (!hasPermission("platform.analytics")) return <Restricted/>;
  const customers = platformUsers.filter((item) => item.role === "customer").length;
  return <ScreenContainer><AppHeader title="Administration overview" subtitle={`Signed in as ${user?.name}`} onNotifications={() => navigation.navigate("Moderation")}/><View style={styles.warning}><AppIcon name="shield-outline" size={20} color={colors.warning}/><Text style={styles.warningText}>Development administration · Actions are simulated and affect no production records.</Text></View><View style={styles.stats}><DashboardStatCard label="Total users" value="1,284" icon="users-outline"/><DashboardStatCard label="Active customers" value={customers} icon="person-outline" tone="green"/><DashboardStatCard label="Facilities" value={facilities.length} icon="business-outline"/><DashboardStatCard label="Active listings" value={products.filter((item) => item.status === "Active").length} icon="cube-outline" tone="green"/><DashboardStatCard label="Pending reviews" value={moderationQueue.length} icon="file-warning-outline" tone="warning" helper="Needs attention"/><DashboardStatCard label="Reports & flags" value={2} icon="alert-circle-outline" tone="error"/></View><SectionHeader title="Platform management"/><View style={styles.quickGrid}><QuickAction label="Users & roles" icon="users-outline" onPress={() => navigation.navigate("Users")}/><QuickAction label="Facilities" icon="business-outline" onPress={() => navigation.navigate("Facilities")}/><QuickAction label="Categories" icon="tags-outline" onPress={() => navigation.navigate("RoleSettings")}/><QuickAction label="Moderation" icon="file-warning-outline" onPress={() => navigation.navigate("Moderation")}/></View><SectionHeader title="Recent platform activity"/>{["Facility record updated","Electronics category policy updated","Reported listing moved to evidence review"].map((item, index) => <View key={item} style={styles.activity}><View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View><View style={styles.flex}><Text style={styles.activityTitle}>{item}</Text><Text style={styles.meta}>{index === 0 ? "12 min ago" : index === 1 ? "2 hr ago" : "Yesterday"}</Text></View><AppIcon name="chevron-forward" size={18} color={colors.textSecondary}/></View>)}</ScreenContainer>;
}

export function UserManagementScreen() {
  const { hasPermission } = useApp();
  const [query, setQuery] = React.useState("");
  const [action, setAction] = React.useState<{ name: string; type: "role" | "deactivate" } | null>(null);
  const [notice, setNotice] = React.useState("");
  if (!hasPermission("platform.user_manage")) return <Restricted/>;
  const shown = platformUsers.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()) || item.email.includes(query.toLowerCase()));
  return <ScreenContainer><Text style={styles.title}>User Management</Text><Text style={styles.subtitle}>Search accounts and demonstrate authorised role actions.</Text><SearchBar value={query} onChangeText={setQuery} placeholder="Search name or email"/>{notice && <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View>}<View style={styles.list}>{shown.map((item) => <View key={item.id}><UserManagementCard user={item}/><View style={styles.userActions}><Pressable onPress={() => setAction({ name: item.name, type: "role" })}><Text style={styles.textAction}>Change role</Text></Pressable><Pressable onPress={() => setAction({ name: item.name, type: "deactivate" })}><Text style={styles.dangerAction}>Deactivate</Text></Pressable></View></View>)}</View><ConfirmDialog visible={action !== null} destructive={action?.type === "deactivate"} title={action?.type === "role" ? `Change ${action.name}'s role?` : `Deactivate ${action?.name}?`} message="This is a mock administrative action. Passwords and sensitive account details are never displayed." confirmLabel={action?.type === "role" ? "Apply mock role" : "Deactivate account"} onCancel={() => setAction(null)} onConfirm={() => { setNotice(`${action?.type === "role" ? "Role update" : "Deactivation"} simulated for ${action?.name}.`); setAction(null); }}/></ScreenContainer>;
}

export function FacilityAdministrationScreen() {
  const { hasPermission } = useApp();
  if (!hasPermission("platform.facility_manage")) return <Restricted/>;
  return <ScreenContainer><Text style={styles.title}>Facility Management</Text><Text style={styles.subtitle}>Platform-wide facility records and manager assignments.</Text>{facilities.map((item) => <FacilityCard key={item.id} facility={item}/>) }<View style={styles.warning}><AppIcon name="information-circle-outline" size={20} color={colors.warning}/><Text style={styles.warningText}>Manager reassignment requires verified backend authorization in production.</Text></View></ScreenContainer>;
}

export function ListingModerationScreen() {
  const { hasPermission } = useApp();
  const [selected, setSelected] = React.useState<string | null>(null);
  if (!hasPermission("platform.listing_moderate")) return <Restricted/>;
  return <ScreenContainer><Text style={styles.title}>Listing Moderation</Text><Text style={styles.subtitle}>Reported listings and flagged platform content.</Text>{moderationQueue.map((item) => <View key={item.id} style={styles.moderation}><View style={styles.between}><Text style={styles.caseId}>{item.id}</Text><StatusBadge status={item.status}/></View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.reason} · Seller: {item.seller}</Text><View style={styles.moderationActions}><Pressable style={styles.review}><Text style={styles.reviewText}>Request evidence</Text></Pressable><Pressable style={styles.remove} onPress={() => setSelected(item.id)}><Text style={styles.removeText}>Remove listing</Text></Pressable></View></View>)}<ConfirmDialog visible={selected !== null} destructive title="Remove this listing?" message="This sensitive moderation action is simulated. No production listing or seller account will change." confirmLabel="Remove listing" onCancel={() => setSelected(null)} onConfirm={() => setSelected(null)}/></ScreenContainer>;
}

function QuickAction({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.quick}><View style={styles.quickIcon}><AppIcon name={icon} size={22} color={colors.terracotta}/></View><Text style={styles.quickLabel}>{label}</Text><AppIcon name="chevron-forward" size={16} color={colors.textSecondary}/></Pressable>;
}

function Restricted() {
  return <ScreenContainer><EmptyState icon="shield-outline" title="Administrator access required" message="This route is protected by the central role permission map."/></ScreenContainer>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.heading, color: colors.charcoal },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg },
  warning: { flexDirection: "row", gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.creamSecondary, padding: spacing.sm },
  warningText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  stats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.lg },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.sm },
  quick: { width: "48.5%", minHeight: 88, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  quickIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.creamSecondary, alignItems: "center", justifyContent: "center" },
  quickLabel: { ...typography.caption, color: colors.charcoal, fontWeight: "700", marginTop: spacing.xs },
  activity: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  number: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.charcoal, alignItems: "center", justifyContent: "center" },
  numberText: { ...typography.label, color: colors.white },
  activityTitle: { ...typography.caption, color: colors.charcoal, fontWeight: "700" },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  list: { marginTop: spacing.md },
  userActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md, marginTop: -spacing.xs, marginBottom: spacing.md },
  textAction: { ...typography.caption, color: colors.terracotta, fontWeight: "700" },
  dangerAction: { ...typography.caption, color: colors.error, fontWeight: "700" },
  notice: { borderRadius: radius.md, backgroundColor: colors.creamSecondary, padding: spacing.sm, marginTop: spacing.md },
  noticeText: { ...typography.caption, color: colors.green },
  moderation: { borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  caseId: { ...typography.label, color: colors.error },
  cardTitle: { ...typography.medium, color: colors.charcoal, marginTop: spacing.sm },
  moderationActions: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.md },
  review: { flex: 1, minHeight: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  reviewText: { ...typography.caption, color: colors.charcoal, fontWeight: "700" },
  remove: { flex: 1, minHeight: 40, borderRadius: radius.sm, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  removeText: { ...typography.caption, color: colors.white, fontWeight: "700" },
});
