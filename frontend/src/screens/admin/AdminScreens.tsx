import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader, ConfirmDialog, EmptyState, ErrorMessage, LoadingIndicator, ScreenContainer, SearchBar, SectionHeader, StatusBadge } from "../../components/core";
import { AppIcon } from "../../components/AppIcon";
import { DashboardStatCard, FacilityCard, UserManagementCard } from "../../components/roles";
import { useApp } from "../../context/AppContext";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";
import { AdminStats, ModerationCase, PlatformUser } from "../../types";
import { formatMonth, timeAgo } from "../../utils/format";

export function AdminDashboard({ navigation }: { navigation: any }) {
  const { user, hasPermission } = useApp();
  const allowed = hasPermission("platform.analytics");
  const { data: stats, error, loading } = useApiData(async () => allowed ? api.adminStats() : null, [allowed]);
  if (!allowed) return <Restricted/>;
  const value = (pick: (s: AdminStats) => number) => stats ? pick(stats).toLocaleString() : "–";
  return <ScreenContainer><AppHeader title="Administration overview" subtitle={`Signed in as ${user?.name}`} onNotifications={() => navigation.navigate("Moderation")}/>{error && <ErrorMessage message={error}/>}<View style={styles.stats}><DashboardStatCard label="Total users" value={value((s) => s.totalUsers)} icon="users-outline"/><DashboardStatCard label="Active customers" value={value((s) => s.activeCustomers)} icon="person-outline" tone="green"/><DashboardStatCard label="Facilities" value={value((s) => s.facilities)} icon="business-outline"/><DashboardStatCard label="Active listings" value={value((s) => s.activeListings)} icon="cube-outline" tone="green"/><DashboardStatCard label="Pending reviews" value={value((s) => s.pendingReviews)} icon="file-warning-outline" tone="warning" helper="Needs attention"/><DashboardStatCard label="Reports & flags" value={value((s) => s.reportsAndFlags)} icon="alert-circle-outline" tone="error"/></View><SectionHeader title="Platform management"/><View style={styles.quickGrid}><QuickAction label="Users & roles" icon="users-outline" onPress={() => navigation.navigate("Users")}/><QuickAction label="Facilities" icon="business-outline" onPress={() => navigation.navigate("Facilities")}/><QuickAction label="Categories" icon="tags-outline" onPress={() => navigation.navigate("RoleSettings")}/><QuickAction label="Moderation" icon="file-warning-outline" onPress={() => navigation.navigate("Moderation")}/></View><SectionHeader title="Recent platform activity"/>{loading && !stats && <LoadingIndicator/>}{stats?.recentActivity.length === 0 && <Text style={styles.meta}>No activity yet.</Text>}{stats?.recentActivity.map((item, index) => <View key={`${item.at}-${index}`} style={styles.activity}><View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View><View style={styles.flex}><Text style={styles.activityTitle}>{item.description}</Text><Text style={styles.meta}>{timeAgo(item.at)}</Text></View></View>)}</ScreenContainer>;
}

export function UserManagementScreen() {
  const { user: me, hasPermission } = useApp();
  const allowed = hasPermission("platform.user_manage");
  const [query, setQuery] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [action, setAction] = React.useState<{ user: PlatformUser; type: "role" | "status" } | null>(null);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);
  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const { data: users = [], error, loading, setData } = useApiData(async () => allowed ? api.adminUsers(search) : [], [allowed, search]);
  if (!allowed) return <Restricted/>;

  const apply = async () => {
    if (!action) return;
    const { user, type } = action;
    setAction(null);
    try {
      const updated = type === "role"
        ? await api.setUserRole(user.id, user.role === "admin" ? "customer" : "admin")
        : await api.setUserStatus(user.id, user.status === "Inactive" ? "Active" : "Inactive");
      setData(users.map((item) => item.id === updated.id ? updated : item));
      setNotice({ ok: true, text: type === "role" ? `${updated.name} is now ${updated.role === "admin" ? "an administrator" : "a customer"}.` : `${updated.name}'s account is now ${updated.status.toLowerCase()}.` });
    } catch (caught) {
      setNotice({ ok: false, text: errorMessage(caught) });
    }
  };

  const target = action?.user;
  const failure = notice && !notice.ok ? notice.text : error;
  return <ScreenContainer><Text style={styles.title}>User Management</Text><Text style={styles.subtitle}>Search accounts, change roles, and deactivate access.</Text><SearchBar value={query} onChangeText={setQuery} placeholder="Search name or email"/>{notice?.ok && <View style={styles.notice}><Text style={styles.noticeText}>{notice.text}</Text></View>}{failure && <ErrorMessage message={failure}/>}<View style={styles.list}>{loading && users.length === 0 ? <LoadingIndicator/> : users.length === 0 ? <EmptyState icon="users-outline" title="No users found" message="Try another name or email."/> : users.map((item) => <View key={item.id}><UserManagementCard user={{ ...item, joined: formatMonth(item.joined) }}/>{item.id !== me?.id && <View style={styles.userActions}><Pressable onPress={() => setAction({ user: item, type: "role" })}><Text style={styles.textAction}>{item.role === "admin" ? "Make customer" : "Make admin"}</Text></Pressable><Pressable onPress={() => setAction({ user: item, type: "status" })}><Text style={item.status === "Inactive" ? styles.textAction : styles.dangerAction}>{item.status === "Inactive" ? "Reactivate" : "Deactivate"}</Text></Pressable></View>}</View>)}</View><ConfirmDialog visible={action !== null} destructive={action?.type === "status" && target?.status !== "Inactive"} title={action?.type === "role" ? `Change ${target?.name}'s role?` : `${target?.status === "Inactive" ? "Reactivate" : "Deactivate"} ${target?.name}?`} message={action?.type === "role" ? `${target?.name} will become ${target?.role === "admin" ? "a customer" : "an administrator"} and is signed out of their current session.` : target?.status === "Inactive" ? "They will be able to sign in again." : "They are signed out immediately and can't sign in until reactivated."} confirmLabel={action?.type === "role" ? "Change role" : target?.status === "Inactive" ? "Reactivate account" : "Deactivate account"} onCancel={() => setAction(null)} onConfirm={apply}/></ScreenContainer>;
}

export function FacilityAdministrationScreen() {
  const { hasPermission } = useApp();
  const allowed = hasPermission("platform.facility_manage");
  const { data: facilities = [], error, loading } = useApiData(async () => allowed ? api.facilities() : [], [allowed]);
  if (!allowed) return <Restricted/>;
  return <ScreenContainer><Text style={styles.title}>Facility Management</Text><Text style={styles.subtitle}>Platform-wide facility records and manager assignments.</Text>{error && <ErrorMessage message={error}/>}{loading && facilities.length === 0 ? <LoadingIndicator/> : facilities.map((item) => <FacilityCard key={item.id} facility={item}/>)}</ScreenContainer>;
}

export function ListingModerationScreen() {
  const { hasPermission } = useApp();
  const allowed = hasPermission("platform.listing_moderate");
  const [selected, setSelected] = React.useState<ModerationCase | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const { data: cases = [], error, loading, setData } = useApiData(async () => allowed ? api.moderation() : [], [allowed]);
  if (!allowed) return <Restricted/>;

  const run = async (item: ModerationCase, kind: "evidence" | "remove") => {
    setSelected(null);
    try {
      const updated = await (kind === "evidence" ? api.requestEvidence(item.id) : api.removeListing(item.id));
      // Removed cases are closed and drop out of the open queue.
      setData(kind === "remove" ? cases.filter((c) => c.id !== item.id) : cases.map((c) => c.id === item.id ? updated : c));
      setActionError(null);
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  const failure = actionError ?? error;
  return <ScreenContainer><Text style={styles.title}>Listing Moderation</Text><Text style={styles.subtitle}>Reported listings and flagged platform content.</Text>{failure && <ErrorMessage message={failure}/>}{loading && cases.length === 0 ? <LoadingIndicator/> : cases.length === 0 ? <EmptyState icon="shield-outline" title="Queue is clear" message="No open reports right now."/> : cases.map((item) => <View key={item.id} style={styles.moderation}><View style={styles.between}><Text style={styles.caseId}>{item.id}</Text><StatusBadge status={item.status}/></View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.reason} · Seller: {item.seller} · {timeAgo(item.createdAt)}</Text><View style={styles.moderationActions}>{item.status !== "Evidence requested" && <Pressable style={styles.review} onPress={() => run(item, "evidence")}><Text style={styles.reviewText}>Request evidence</Text></Pressable>}<Pressable style={styles.remove} onPress={() => setSelected(item)}><Text style={styles.removeText}>Remove listing</Text></Pressable></View></View>)}<ConfirmDialog visible={selected !== null} destructive title="Remove this listing?" message={selected?.productId ? "The listing is taken off the marketplace and the seller can't relist it." : "This report isn't linked to a live listing; the case will be closed as removed."} confirmLabel="Remove listing" onCancel={() => setSelected(null)} onConfirm={() => { if (selected) void run(selected, "remove"); }}/></ScreenContainer>;
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
