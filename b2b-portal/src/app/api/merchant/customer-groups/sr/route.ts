import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant, query } from "@/lib/db";
import {
  loadMerchantShoprenterConfig,
  purgePortalCustomerGroup,
  type CustomerGroupRole,
} from "@/lib/merchant/customer-group-map";
import {
  countMirroredTierProducts,
  listMirroredSpecialIdsForGroup,
} from "@/lib/commerce/volume-tier-mirror";
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

        const pct =
          group.percentDiscount != null &&
          Number.isFinite(group.percentDiscount) &&
          group.percentDiscount > 0
            ? Math.min(100, Math.trunc(group.percentDiscount))
            : 0;
        await query(
          client,
          `insert into shop_customer_group_map (
             shop_id, sr_group_inner_id, sr_group_id, sr_name_snapshot,
             role, is_default_in_sr, percent_discount
           ) values ($1,$2,$3,$4,$5,false,$6)
           on conflict (shop_id, sr_group_inner_id) do update set
             sr_group_id = excluded.sr_group_id,
             sr_name_snapshot = excluded.sr_name_snapshot,
             role = excluded.role,
             percent_discount = excluded.percent_discount,
             updated_at = now()`,
          [loaded.shopId, group.innerId, group.id, group.name, role, pct],
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

        const pct =
          group.percentDiscount != null &&
          Number.isFinite(group.percentDiscount) &&
          group.percentDiscount > 0
            ? Math.min(100, Math.trunc(group.percentDiscount))
            : 0;
        await query(
          client,
          `update shop_customer_group_map
           set sr_name_snapshot = $3,
               sr_group_id = $2,
               percent_discount = $5,
               updated_at = now()
           where shop_id = $1 and sr_group_inner_id = $4`,
          [loaded.shopId, group.id, group.name, group.innerId, pct],
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
 * DELETE /api/merchant/customer-groups/sr?id=&innerId=&forcePrices=
 *
 * - Élő SR csoport → törlés boltban + portal tükör/map cleanup
 * - Már nincs SR-ben (árva map) → csak portal cleanup (nincs force kell)
 *
 * Edge cases:
 * - Alap csoport: tiltva (élő)
 * - Van fix ár / sáv tükör: 409 + needsForce (élő)
 * - SR lista hiba: nem purgelünk „árvának” (hamis orphan)
 * - shop_customers / rendelés history: nem töröljük
 */
export async function DELETE(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim() || "";
  const innerRaw = url.searchParams.get("innerId")?.trim() || "";
  const innerIdParam =
    innerRaw && Number.isFinite(Number(innerRaw))
      ? Math.round(Number(innerRaw))
      : null;
  const forcePrices = url.searchParams.get("forcePrices") === "1";

  if (!id && (innerIdParam == null || innerIdParam <= 0)) {
    return NextResponse.json(
      { error: "Hiányzik a csoport id vagy innerId." },
      { status: 400 },
    );
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

        const mapRes = await query<{
          sr_group_inner_id: number;
          sr_group_id: string | null;
          sr_name_snapshot: string;
          is_default_in_sr: boolean;
        }>(
          client,
          `select sr_group_inner_id, sr_group_id, sr_name_snapshot, is_default_in_sr
           from shop_customer_group_map
           where shop_id = $1
             and (
               ($2::text <> '' and sr_group_id = $2)
               or ($3::int is not null and sr_group_inner_id = $3)
             )
           limit 1`,
          [loaded.shopId, id || "", innerIdParam],
        );
        const mapRow = mapRes.rows[0] ?? null;

        const { listCustomerGroups } = await import(
          "@/lib/shoprenter/customers"
        );
        let srGroups;
        try {
          srGroups = await listCustomerGroups(loaded.config, {
            bypassCache: true,
          });
        } catch (e) {
          console.error("[DELETE customer-groups/sr] list failed", e);
          throw new Error("SR_LIST_FAILED");
        }

        const srGroup =
          (id
            ? srGroups.find((g) => g.id === id)
            : undefined) ??
          (innerIdParam != null
            ? srGroups.find((g) => g.innerId === innerIdParam)
            : undefined) ??
          (mapRow
            ? srGroups.find(
                (g) =>
                  g.innerId === mapRow.sr_group_inner_id ||
                  (mapRow.sr_group_id != null &&
                    g.id === mapRow.sr_group_id),
              )
            : undefined);

        // —— Árva: nincs a boltban ——
        if (!srGroup) {
          if (!mapRow) throw new Error("GROUP_NOT_FOUND");
          const outer =
            (id || mapRow.sr_group_id || "").trim() || null;
          const purged = await purgePortalCustomerGroup(client, {
            shopId: loaded.shopId,
            groupInnerId: mapRow.sr_group_inner_id,
            groupOuterId: outer,
          });
          if (purged.mapDeleted < 1) throw new Error("GROUP_NOT_FOUND");
          return {
            mode: "orphan" as const,
            blocked: false as const,
            deleted: true as const,
            purged,
          };
        }

        // —— Élő SR csoport ——
        if (srGroup.isDefault) throw new Error("DEFAULT_GROUP");

        const outerId = srGroup.id;
        const ownCount = await countGroupPrices(loaded.config, outerId).catch(
          () => 0,
        );
        const tierProducts = await countMirroredTierProducts(
          client,
          loaded.shopId,
          outerId,
        ).catch(() => 0);

        if ((ownCount > 0 || tierProducts > 0) && !forcePrices) {
          const parts: string[] = [];
          if (ownCount > 0) parts.push(`${ownCount} fix ár`);
          if (tierProducts > 0) parts.push(`${tierProducts} sávos termék`);
          return {
            mode: "live" as const,
            blocked: true as const,
            ownPriceCount: ownCount,
            tierProductCount: tierProducts,
            message: `Ennek a csoportnak ${parts.join(" és ")} van. Erősítsd meg a törlést (bolt + portal adatok törlődnek).`,
          };
        }

        if (forcePrices && ownCount > 0) {
          const {
            listGroupPricesForGroup,
            deleteGroupPrice,
          } = await import("@/lib/shoprenter/group-prices");
          const prices = await listGroupPricesForGroup(loaded.config, outerId);
          for (const p of prices) {
            await deleteGroupPrice(loaded.config, p.id);
            await new Promise((r) => setTimeout(r, 80));
          }
        }

        if (forcePrices && tierProducts > 0) {
          const { deleteProductSpecial } = await import(
            "@/lib/shoprenter/product-specials"
          );
          const specialIds = await listMirroredSpecialIdsForGroup(
            client,
            loaded.shopId,
            outerId,
          );
          for (const sid of specialIds) {
            try {
              await deleteProductSpecial(loaded.config, sid);
              await new Promise((r) => setTimeout(r, 60));
            } catch (e) {
              console.warn(
                "[DELETE customer-groups/sr] special cleanup",
                sid,
                e,
              );
            }
          }
        }

        await deleteCustomerGroupSr(loaded.config, outerId);

        const purged = await purgePortalCustomerGroup(client, {
          shopId: loaded.shopId,
          groupInnerId: srGroup.innerId,
          groupOuterId: outerId,
        });

        return {
          mode: "live" as const,
          blocked: false as const,
          deleted: true as const,
          purged,
        };
      },
    );

    if ("blocked" in result && result.blocked) {
      return NextResponse.json(
        {
          error: result.message,
          ownPriceCount: result.ownPriceCount,
          tierProductCount: result.tierProductCount,
          needsForce: true,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      message:
        result.mode === "orphan"
          ? "Eltávolítva a portálból (a boltban már nem volt)."
          : "Csoport törölve a boltból és a portálból.",
      purged: "purged" in result ? result.purged : undefined,
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
    if (msg === "SR_LIST_FAILED") {
      return NextResponse.json(
        {
          error:
            "A bolt csoportlistája nem elérhető. Próbáld újra. Árva takarítást csak biztos SR válasz után végzünk.",
        },
        { status: 503 },
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
