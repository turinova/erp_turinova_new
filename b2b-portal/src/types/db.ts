/** DB row types — mirrors b2b-portal/sql/*.sql */

import type { PlanId } from "@/lib/billing/plans";

export type OrgStatus = "trial" | "active" | "suspended";
export type { PlanId } from "@/lib/billing/plans";
export type MembershipRole = "owner" | "admin" | "member";
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";
export type ShopStatus =
  | "draft"
  | "active"
  | "needs_reauth"
  | "suspended"
  | "uninstalled";
export type ShopAuthType = "oauth" | "basic_legacy";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  plan: PlanId;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string | null;
  is_platform_admin: boolean;
  last_login_at: string | null;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Membership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: MembershipRole;
  created_at: string;
};

export type Invitation = {
  id: string;
  organization_id: string;
  email: string;
  role: MembershipRole;
  token_hash: string;
  status: InviteStatus;
  invited_by_user_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type Session = {
  id: string;
  user_id: string;
  active_organization_id: string | null;
  expires_at: string;
  revoked_at: string | null;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
};

export type Shop = {
  id: string;
  organization_id: string;
  shoprenter_shop_name: string;
  store_url: string | null;
  public_id: string;
  status: ShopStatus;
  widget_enabled: boolean;
  last_ping_at: string | null;
  last_ping_ok: boolean | null;
  last_ping_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ShopCredentialsRow = {
  shop_id: string;
  auth_type: ShopAuthType;
  ciphertext: Buffer;
  iv: Buffer;
  key_version: number;
  token_expires_at: string | null;
  rotated_at: string;
  created_at: string;
  updated_at: string;
};

/** Plaintext shape before AES-GCM encrypt — never log / never send to client */
export type ShopCredentialsPlain =
  | {
      auth_type: "oauth";
      client_id: string;
      client_secret: string;
    }
  | {
      auth_type: "basic_legacy";
      username: string;
      password: string;
    };

export type ShopAllowedOrigin = {
  id: string;
  shop_id: string;
  origin: string;
  created_at: string;
};

export type WidgetSettings = {
  shop_id: string;
  button_label: string;
  customer_group_ids: number[];
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CustomerGroupRole = "bolt" | "gomb" | "rejtett";

export type ShopCustomerGroupMap = {
  id: string;
  shop_id: string;
  sr_group_inner_id: number;
  sr_group_id: string | null;
  sr_name_snapshot: string;
  role: CustomerGroupRole;
  is_default_in_sr: boolean;
  created_at: string;
  updated_at: string;
};

export type ShopCustomer = {
  id: string;
  shop_id: string;
  sr_customer_inner_id: number;
  sr_customer_id: string | null;
  email: string | null;
  name_snapshot: string | null;
  sr_group_inner_id: number | null;
  sr_group_name_snapshot: string | null;
  sr_status: "active" | "missing" | "deleted";
  created_at: string;
  updated_at: string;
};

export type AuditEvent = {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type DbTenantContext = {
  organizationId: string | null;
  userId: string | null;
  /** Sets app.is_platform_admin for RLS bypass path */
  isPlatformAdmin?: boolean;
};
