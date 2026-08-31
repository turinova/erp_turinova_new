import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import {
  loadMerchantShoprenterConfig,
  saveGroupMap,
  type CustomerGroupRole,
} from "@/lib/merchant/customer-group-map";
import {
  groupMapItemsFromDb,
  softSyncCustomerGroupsFromShoprenter,
} from "@/lib/merchant/customer-group-sync";
import { listCustomerGroups } from "@/lib/shoprenter/customers";

/**
 * GET — csoportok a DB mapból (bootstrap / cron tölti).
 * ?sync=1 — egyszeri élő soft-sync a Shoprenterből (haladó).
 */
export async function GET(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const forceSync =
    new URL(req.url).searchParams.get("sync") === "1" ||
    new URL(req.url).searchParams.get("sync") === "true";

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

        let liveGroups: Awaited<ReturnType<typeof listCustomerGroups>> | undefined;
        if (forceSync) {
          liveGroups = await listCustomerGroups(loaded.config);
          await softSyncCustomerGroupsFromShoprenter(
            client,
            loaded.shopId,
            loaded.config,
          );
        }

        const groups = await groupMapItemsFromDb(client, loaded.shopId, {
          config: loaded.config,
          liveGroups,
        });

        return { shopId: loaded.shopId, groups, syncedFromShop: forceSync };
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
