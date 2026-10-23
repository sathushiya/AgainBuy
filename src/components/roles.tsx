import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { DemoUser, Facility, AppUser, UserRole } from "../types";
import { colors, radius, shadows, spacing, typography } from "../theme";
import { AppIcon, AppIconName } from "./AppIcon";
import { PrimaryButton, SecondaryButton, StatusBadge } from "./core";

const roleLabels: Record<UserRole, string> = {
  customer: "Customer",
  admin: "Administrator",
};

const roleIcons: Record<UserRole, AppIconName> = {
  customer: "person-outline",
  admin: "shield-outline",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return <View style={styles.roleBadge}><AppIcon name={roleIcons[role]} size={14} color={colors.terracotta}/><Text style={styles.roleText}>{roleLabels[role]}</Text></View>;
}

export function DemoAccountCard({ account, onUse, onQuickLogin, loading }: { account: DemoUser; onUse: () => void; onQuickLogin: () => void; loading?: boolean }) {
  return <View style={styles.demoCard}><View style={styles.between}><RoleBadge role={account.role}/><Text style={styles.development}>DEVELOPMENT ONLY</Text></View><Text style={styles.description}>{account.description}</Text><View style={styles.credentials}><Text style={styles.credential}>{account.email}</Text><Text style={styles.credential}>{account.password}</Text></View><View style={styles.actions}><SecondaryButton title="Fill credentials" onPress={onUse} style={styles.flex}/><PrimaryButton title={loading ? "Signing in…" : "Quick login"} onPress={onQuickLogin} disabled={loading} style={styles.flex}/></View></View>;
}

export function DashboardStatCard({ label, value, icon, tone = "terracotta", helper }: { label: string; value: string | number; icon: AppIconName; tone?: "terracotta" | "green" | "warning" | "error"; helper?: string }) {
  const toneColor = tone === "green" ? colors.green : tone === "warning" ? colors.warning : tone === "error" ? colors.error : colors.terracotta;
  return <View style={styles.statCard}><View style={[styles.statIcon, { borderColor: toneColor }]}><AppIcon name={icon} size={21} color={toneColor}/></View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text>{helper && <Text style={[styles.statHelper, { color: toneColor }]}>{helper}</Text>}</View>;
}

export function FacilityCard({ facility, onPress }: { facility: Facility; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.cardIcon}><AppIcon name="business-outline" size={23} color={colors.terracotta}/></View><View style={styles.flex}><Text style={styles.cardTitle}>{facility.name}</Text><Text style={styles.meta}>{facility.location} · {facility.resourceCount} resources</Text><Text style={styles.meta}>{facility.activeBookings} current bookings</Text></View><StatusBadge status={facility.status}/></Pressable>;
}

export function UserManagementCard({ user, onPress }: { user: { name: string; email: string; role: UserRole; status: string; joined: string }; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.initial}><Text style={styles.initialText}>{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</Text></View><View style={styles.flex}><Text style={styles.cardTitle}>{user.name}</Text><Text style={styles.meta}>{user.email} · Joined {user.joined}</Text><RoleBadge role={user.role}/></View><StatusBadge status={user.status}/></Pressable>;
}

export function ProfileHeader({ user }: { user: AppUser }) {
  return <View style={styles.profile}><Image source={{ uri: user.avatar }} style={styles.avatar}/><Text style={styles.profileName}>{user.name}</Text><Text style={styles.profileMeta}>{user.email}</Text><Text style={styles.profileMeta}>{user.location}</Text><RoleBadge role={user.role}/></View>;
}

export function LogoutButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}><AppIcon name="log-out-outline" size={20} color={colors.error}/><Text style={styles.logoutText}>Log Out</Text></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
  pressed: { opacity: 0.78 },
  roleBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.xxs, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.creamSecondary },
  roleText: { ...typography.label, color: colors.terracotta },
  demoCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: spacing.md, gap: spacing.sm },
  development: { ...typography.label, fontSize: 9, color: colors.warning },
  description: { ...typography.caption, color: colors.textSecondary },
  credentials: { borderRadius: radius.sm, backgroundColor: colors.cream, padding: spacing.sm, gap: 3 },
  credential: { ...typography.caption, color: colors.charcoal },
  actions: { flexDirection: "row", gap: spacing.xs },
  statCard: { width: "48.5%", minHeight: 136, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadows.card },
  statIcon: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.creamSecondary, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  statValue: { fontSize: 24, lineHeight: 28, fontWeight: "800", color: colors.charcoal },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statHelper: { ...typography.label, marginTop: spacing.xs },
  card: { minHeight: 84, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.sm },
  cardIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.creamSecondary, alignItems: "center", justifyContent: "center" },
  cardTitle: { ...typography.medium, color: colors.charcoal },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  initial: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.charcoal, alignItems: "center", justifyContent: "center" },
  initialText: { ...typography.medium, color: colors.white },
  profile: { alignItems: "center", paddingVertical: spacing.lg },
  avatar: { width: 88, height: 88, borderRadius: 32, backgroundColor: colors.creamSecondary },
  profileName: { ...typography.heading, color: colors.charcoal, marginTop: spacing.sm },
  profileMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  logout: { minHeight: 52, borderRadius: radius.md, marginTop: spacing.lg, backgroundColor: colors.creamSecondary, borderWidth: 1, borderColor: colors.error, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  logoutText: { ...typography.medium, color: colors.error },
});
