import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import {
  loadMerchantShoprenterConfig,
  listGroupMap,
  saveGroupMap,
  type CustomerGroupRole,
  type GroupMapItemDto,
} from "@/lib/merchant/customer-group-map";
import { listCustomerGroups } from "@/lib/shoprenter/customers";

export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  try {
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      async (client) => {
        const loaded = await loadMerchantShoprenterConfig(
          client,
          auth.activeOrganizationId!,
        );
        if (!loaded) return { error: "NO_SHOP_OR_CREDS" as const };

        const srGroups = await listCustomerGroups(loaded.config);
        const mapRows = await listGroupMap(client, loaded.shopId);
        const roleByInner = new Map(
          mapRows.map((r) => [r.sr_group_inner_id, r.role]),
        );

        // Soft-sync SR ids/names into map (keep existing roles)
        for (const g of srGroups) {
          await client.query(
            `insert into shop_customer_group_map (
               shop_id, sr_group_inner_id, sr_group_id, sr_name_snapshot,
               role, is_default_in_sr
             ) values ($1,$2,$3,$4,'bolt',$5)
             on conflict (shop_id, sr_group_inner_id) do update set
               sr_group_id = excluded.sr_group_id,
               sr_name_snapshot = excluded.sr_name_snapshot,
               is_default_in_sr = excluded.is_default_in_sr,
               updated_at = now()`,
            [loaded.shopId, g.innerId, g.id, g.name, g.isDefault],
          );
        }

        const refreshed = await listGroupMap(client, loaded.shopId);
        const roleByInner2 = new Map(
          refreshed.map((r) => [r.sr_group_inner_id, r.role]),
        );

        const groups: GroupMapItemDto[] = srGroups.map((g) => ({
          innerId: g.innerId,
          groupId: g.id,
          name: g.name,
          role: (roleByInner2.get(g.innerId) ??
            roleByInner.get(g.innerId) ??
            "bolt") as CustomerGroupRole,
          isDefault: g.isDefault,
          percentDiscount: g.percentDiscount,
        }));

        for (const row of refreshed) {
          if (!groups.some((g) => g.innerId === row.sr_group_inner_id)) {
            groups.push({
              innerId: row.sr_group_inner_id,
              groupId: row.sr_group_id,
              name: `${row.sr_name_snapshot} (hiányzik a boltból)`,
              role: "rejtett",
              isDefault: row.is_default_in_sr,
              percentDiscount: null,
            });
          }
        }

        return { shopId: loaded.shopId, groups };
      },
    );

    if ("error" in result && result.error === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        {
          error:
            "Nincs bolt vagy API kulcs. Állítsd be a Beállításokban.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[GET merchant/customer-groups]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Csoportok betöltése sikertelen",
      },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: { groups?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  if (!Array.isArray(body.groups)) {
    return NextResponse.json(
      { error: "groups tömb kell" },
      { status: 400 },
    );
  }

  const items = body.groups
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const g = raw as Record<string, unknown>;
      const innerId = Number(g.innerId);
      const role = String(g.role || "bolt");
      if (!Number.isFinite(innerId)) return null;
      if (role !== "bolt" && role !== "gomb" && role !== "rejtett") return null;
      return {
        innerId,
        groupId: typeof g.groupId === "string" ? g.groupId : null,
        name: typeof g.name === "string" ? g.name : `Csoport ${innerId}`,
        role: role as CustomerGroupRole,
        isDefault: Boolean(g.isDefault),
      };
    })
    .filter(Boolean) as {
    innerId: number;
    groupId: string | null;
    name: string;
    role: CustomerGroupRole;
    isDefault: boolean;
  }[];

  try {
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      async (client) => {
        const loaded = await loadMerchantShoprenterConfig(
          client,
          auth.activeOrganizationId!,
        );
        if (!loaded) throw new Error("NO_SHOP_OR_CREDS");
        const allowed = await saveGroupMap(
          client,
          loaded.shopId,
          auth.activeOrganizationId!,
          auth.userId,
          items,
        );
        return { allowedGroupIds: allowed };
      },
    );

    return NextResponse.json({
      ok: true,
      ...result,
      message: "Mentve.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    console.error("[PUT merchant/customer-groups]", err);
    return NextResponse.json({ error: "Mentés sikertelen" }, { status: 500 });
  }
}
