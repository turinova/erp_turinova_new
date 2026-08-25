import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant, query } from "@/lib/db";
import {
  loadMerchantShoprenterConfig,
  type CustomerGroupRole,
} from "@/lib/merchant/customer-group-map";
import {
  createCustomerGroup,
  deleteCustomerGroupSr,
  updateCustomerGroupMeta,
} from "@/lib/shoprenter/customer-groups-write";
import { countGroupPrices } from "@/lib/shoprenter/group-prices";

/**
 * POST /api/merchant/customer-groups/sr
 * { name, percentDiscount?, role? }
 */
export async function POST(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: {
    name?: string;
    percentDiscount?: number | null;
    role?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return NextResponse.json(
      { error: "Add meg a csoport nevét (legalább 2 karakter)." },
      { status: 400 },
    );
  }

  const roleRaw = body.role || "bolt";
  const role: CustomerGroupRole =
    roleRaw === "gomb" || roleRaw === "rejtett" ? roleRaw : "bolt";

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

        const group = await createCustomerGroup(loaded.config, {
          name,
          percentDiscount: body.percentDiscount ?? null,
        });

        await query(
          client,
          `insert into shop_customer_group_map (
             shop_id, sr_group_inner_id, sr_group_id, sr_name_snapshot,
             role, is_default_in_sr
           ) values ($1,$2,$3,$4,$5,false)
           on conflict (shop_id, sr_group_inner_id) do update set
             sr_group_id = excluded.sr_group_id,
             sr_name_snapshot = excluded.sr_name_snapshot,
             role = excluded.role,
             updated_at = now()`,
          [loaded.shopId, group.innerId, group.id, group.name, role],
        );

        return { group };
      },
    );

    return NextResponse.json({
      ok: true,
      group: result.group,
      message: `Kész. A „${result.group.name}” csoport létrejött.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    console.error("[POST customer-groups/sr]", err);
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json(
      { error: msg || "Csoport létrehozás sikertelen" },
      { status },
    );
  }
}

/**
 * PATCH /api/merchant/customer-groups/sr  (id in body)
 * { id, name?, percentDiscount? }
 *
 * Also supports DELETE via method override — see DELETE handler with query.
 */
export async function PATCH(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: {
    id?: string;
    name?: string;
    percentDiscount?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Hiányzik a csoport id." }, { status: 400 });
  }

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

        const group = await updateCustomerGroupMeta(loaded.config, id, {
          name: body.name,
          percentDiscount: body.percentDiscount,
        });

        await query(
          client,
          `update shop_customer_group_map
           set sr_name_snapshot = $3, sr_group_id = $2, updated_at = now()
           where shop_id = $1 and sr_group_inner_id = $4`,
          [loaded.shopId, group.id, group.name, group.innerId],
        );

        return { group };
      },
    );

    return NextResponse.json({
      ok: true,
      group: result.group,
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
    console.error("[PATCH customer-groups/sr]", err);
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json(
      { error: msg || "Mentés sikertelen" },
      { status },
    );
  }
}

/**
 * DELETE /api/merchant/customer-groups/sr?id=&forcePrices=
 */
export async function DELETE(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim() || "";
  const forcePrices = url.searchParams.get("forcePrices") === "1";
  if (!id) {
    return NextResponse.json({ error: "Hiányzik a csoport id." }, { status: 400 });
  }

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

        const { listCustomerGroups } = await import(
          "@/lib/shoprenter/customers"
        );
        const groups = await listCustomerGroups(loaded.config, {
          bypassCache: true,
        });
        const group = groups.find((g) => g.id === id);
        if (!group) throw new Error("GROUP_NOT_FOUND");
        if (group.isDefault) {
          throw new Error("DEFAULT_GROUP");
        }

        const ownCount = await countGroupPrices(loaded.config, id);
        if (ownCount > 0 && !forcePrices) {
          return {
            blocked: true as const,
            ownPriceCount: ownCount,
            message: `Ennek a csoportnak ${ownCount} saját ára van. Előbb töröld őket, vagy erősítsd meg.`,
          };
        }

        if (ownCount > 0 && forcePrices) {
          const {
            listGroupPricesForGroup,
            deleteGroupPrice,
          } = await import("@/lib/shoprenter/group-prices");
          const prices = await listGroupPricesForGroup(loaded.config, id);
          for (const p of prices) {
            await deleteGroupPrice(loaded.config, p.id);
            await new Promise((r) => setTimeout(r, 80));
          }
        }

        await deleteCustomerGroupSr(loaded.config, id);

        await query(
          client,
          `delete from shop_customer_group_map
           where shop_id = $1 and sr_group_inner_id = $2`,
          [loaded.shopId, group.innerId],
        );

        return { blocked: false as const, deleted: true as const };
      },
    );

    if ("blocked" in result && result.blocked) {
      return NextResponse.json(
        {
          error: result.message,
          ownPriceCount: result.ownPriceCount,
          needsForce: true,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Csoport törölve.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    if (msg === "DEFAULT_GROUP") {
      return NextResponse.json(
        {
          error:
            "Az alap csoportot nem törölheted. Ezt a Shoprenterben állítsd.",
        },
        { status: 403 },
      );
    }
    if (msg === "GROUP_NOT_FOUND") {
      return NextResponse.json(
        { error: "Ismeretlen vevőcsoport." },
        { status: 404 },
      );
    }
    console.error("[DELETE customer-groups/sr]", err);
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json(
      { error: msg || "Törlés sikertelen" },
      { status },
    );
  }
}
