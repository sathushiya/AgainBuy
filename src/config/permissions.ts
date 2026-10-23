import { UserRole } from "../types";

export type Permission =
  | "marketplace.browse"
  | "listing.create"
  | "listing.manage_own"
  | "transaction.view_own"
  | "platform.analytics"
  | "platform.user_manage"
  | "platform.facility_manage"
  | "platform.category_manage"
  | "platform.listing_moderate"
  | "platform.settings"
  | "profile.manage_own";

export const rolePermissions: Record<UserRole, readonly Permission[]> = {
  customer: ["marketplace.browse", "listing.create", "listing.manage_own", "transaction.view_own", "profile.manage_own"],
  admin: ["platform.analytics", "platform.user_manage", "platform.facility_manage", "platform.category_manage", "platform.listing_moderate", "platform.settings", "profile.manage_own"],
};

export function canAccess(role: UserRole | undefined, permission: Permission) {
  return !!role && rolePermissions[role].includes(permission);
}
