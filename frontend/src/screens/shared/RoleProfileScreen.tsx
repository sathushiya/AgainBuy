import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { ConfirmDialog, ScreenContainer } from "../../components/core";
import { LogoutButton, ProfileHeader } from "../../components/roles";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, typography } from "../../theme";
import { UserRole } from "../../types";

// [icon, label, route, route params]
const roleActions: Record<UserRole, Array<[AppIconName, string, string, object?]>> = {
  customer: [
    ["receipt-outline", "My orders", "Orders", { role: "buyer" }],
    ["list-outline", "Reserved by customers", "Orders", { role: "seller" }],
    ["cube-outline", "My Listings", "MyListings"],
    ["bag-check-outline", "My Purchases", "Purchases"],
    ["pricetag-outline", "My Sales", "Sales"],
    ["heart-outline", "Wishlist", "Wishlist"],
    ["settings-outline", "Settings & Help", "Settings"],
  ],
  admin: [
    ["users-outline", "User Management", "Users"],
    ["business-outline", "Facility Management", "Facilities"],
    ["file-warning-outline", "Listing Moderation", "Moderation"],
    ["settings-outline", "Authorised Settings", "RoleSettings"],
  ],
};

export function RoleProfileScreen({ navigation }: { navigation: any }) {
  const { user, logout } = useApp();
  const [confirm, setConfirm] = React.useState(false);
  if (!user) return null;
  return <ScreenContainer><Text style={styles.title}>Profile</Text><ProfileHeader user={user}/><View style={styles.summary}><View style={styles.summaryItem}><Text style={styles.summaryValue}>{user.role === "customer" ? "4.9" : "Admin"}</Text><Text style={styles.summaryLabel}>{user.role === "customer" ? "Community rating" : "Access level"}</Text></View><View style={styles.summaryItem}><Text style={styles.summaryValue}>{user.role === "customer" ? "2" : "1,284"}</Text><Text style={styles.summaryLabel}>{user.role === "customer" ? "Completed trades" : "Platform users"}</Text></View></View><View style={styles.menu}>{roleActions[user.role].map(([icon, label, route, params]) => <Pressable accessibilityRole="button" key={label} onPress={() => navigation.navigate(route, params)} style={styles.row}><View style={styles.rowIcon}><AppIcon name={icon} size={20} color={colors.terracotta}/></View><Text style={styles.rowText}>{label}</Text><AppIcon name="chevron-forward" size={18} color={colors.textSecondary}/></Pressable>)}<Pressable accessibilityRole="button" onPress={() => navigation.navigate("RoleSettings")} style={styles.row}><View style={styles.rowIcon}><AppIcon name="help-circle-outline" size={20} color={colors.terracotta}/></View><Text style={styles.rowText}>Help & Support</Text><AppIcon name="chevron-forward" size={18} color={colors.textSecondary}/></Pressable></View><LogoutButton onPress={() => setConfirm(true)}/><Text style={styles.note}>Mock role authorization only. Production permissions must be enforced by the backend.</Text><ConfirmDialog visible={confirm} destructive title="Log out of AgainBuy?" message="Your current role session will be cleared and the navigation stack will return to the shared login screen." confirmLabel="Log out" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); logout(); }}/></ScreenContainer>;
}

export function RoleSettingsScreen() {
  const { user } = useApp();
  if (!user) return null;
  return <ScreenContainer><Text style={styles.title}>Settings & Support</Text><Text style={styles.subtitle}>Preferences available to your {user.role.replace("_", " ")} account.</Text>{["Personal information", "Notification preferences", "Privacy and security", "Help centre", "Contact support"].map((label) => <Pressable accessibilityRole="button" key={label} style={styles.setting}><Text style={styles.rowText}>{label}</Text><AppIcon name="chevron-forward" size={18} color={colors.textSecondary}/></Pressable>)}<View style={styles.security}><AppIcon name="shield-checkmark-outline" size={22} color={colors.green}/><Text style={styles.securityText}>Role changes and sensitive permissions require server-side verification in production.</Text></View></ScreenContainer>;
}

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.charcoal },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg },
  summary: { flexDirection: "row", borderRadius: radius.lg, backgroundColor: colors.charcoal, paddingVertical: spacing.md, marginBottom: spacing.lg },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { ...typography.title, color: colors.white },
  summaryLabel: { ...typography.label, color: colors.border, marginTop: 2, textAlign: "center" },
  menu: { borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm },
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.creamSecondary, alignItems: "center", justifyContent: "center" },
  rowText: { ...typography.medium, color: colors.charcoal, flex: 1 },
  note: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md },
  setting: { minHeight: 56, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.xs, flexDirection: "row", alignItems: "center" },
  security: { flexDirection: "row", gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.creamSecondary, padding: spacing.md, marginTop: spacing.lg },
  securityText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
});
