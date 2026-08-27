import type { MembershipRole } from "@/types/db";

/** Product roles: Admin (DB owner/admin) vs User (DB member). */
export function isOrgAdminRole(
  role: MembershipRole | string | null | undefined,
): boolean {
  return role === "owner" || role === "admin";
}

export function roleLabelHu(
  role: MembershipRole | string | null | undefined,
): string {
  if (isOrgAdminRole(role)) return "Admin";
  return "User";
}
