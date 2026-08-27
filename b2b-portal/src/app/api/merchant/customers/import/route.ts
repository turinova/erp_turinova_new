import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import {
  listGroupMap,
  loadMerchantShoprenterConfig,
} from "@/lib/merchant/customer-group-map";
import {
  parseCustomerImportBuffer,
  type CustomerImportRawRow,
} from "@/lib/merchant/customers-xlsx";
import {
  recordGroupMove,
  upsertShopCustomer,
} from "@/lib/merchant/shop-customers";
import {
  listCustomerGroups,
  searchCustomers,
  updateCustomerGroup,
  type SrCustomerGroup,
} from "@/lib/shoprenter/customers";

export type ImportPreviewRow = {
  row: number;
  email: string;
  groupRaw: string;
  status: "ok" | "unknown_email" | "unknown_group" | "invalid" | "same_group";
  message: string;
  customerInnerId: number | null;
  customerName: string | null;
  fromGroupName: string | null;
  toGroupInnerId: number | null;
  toGroupName: string | null;
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function resolveGroup(
  groups: SrCustomerGroup[],
  raw: string,
): SrCustomerGroup | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const id = Number(t);
    return groups.find((g) => g.innerId === id) ?? null;
  }
  const n = norm(t);
  return (
    groups.find((g) => norm(g.name) === n) ||
    groups.find((g) => norm(g.name).includes(n)) ||
    null
  );
}

async function buildPreview(
  config: Parameters<typeof searchCustomers>[0],
  groups: SrCustomerGroup[],
  rawRows: CustomerImportRawRow[],
): Promise<ImportPreviewRow[]> {
  const out: ImportPreviewRow[] = [];
  for (const r of rawRows) {
    if (!r.email || !r.email.includes("@")) {
      out.push({
        row: r.row,
        email: r.email,
        groupRaw: r.groupRaw,
        status: "invalid",
        message: "Érvénytelen email",
        customerInnerId: null,
        customerName: null,
        fromGroupName: null,
        toGroupInnerId: null,
        toGroupName: null,
      });
      continue;
    }
    const group = resolveGroup(groups, r.groupRaw);
    if (!group) {
      out.push({
        row: r.row,
        email: r.email,
        groupRaw: r.groupRaw,
        status: "unknown_group",
        message: r.groupRaw
          ? `Ismeretlen csoport: ${r.groupRaw}`
          : "Nincs csoport megadva",
        customerInnerId: null,
        customerName: null,
        fromGroupName: null,
        toGroupInnerId: null,
        toGroupName: null,
      });
      continue;
    }

    const found = await searchCustomers(config, r.email, {
      limit: 5,
      groups,
    });
    const customer =
      found.find((c) => c.email.toLowerCase() === r.email) || found[0];
    if (!customer) {
      out.push({
        row: r.row,
        email: r.email,
        groupRaw: r.groupRaw,
        status: "unknown_email",
        message: "Nincs ilyen vevő a boltban",
        customerInnerId: null,
        customerName: null,
        fromGroupName: null,
        toGroupInnerId: group.innerId,
        toGroupName: group.name,
      });
      continue;
    }

    const name =
      [customer.lastname, customer.firstname].filter(Boolean).join(" ").trim() ||
      customer.email;

    if (customer.groupInnerId === group.innerId) {
      out.push({
        row: r.row,
        email: r.email,
        groupRaw: r.groupRaw,
        status: "same_group",
        message: "Már ebben a csoportban van",
        customerInnerId: customer.innerId,
        customerName: name,
        fromGroupName: customer.groupName,
        toGroupInnerId: group.innerId,
        toGroupName: group.name,
      });
      continue;
    }

    out.push({
      row: r.row,
      email: r.email,
      groupRaw: r.groupRaw,
      status: "ok",
      message: `${customer.groupName || "—"} → ${group.name}`,
      customerInnerId: customer.innerId,
      customerName: name,
      fromGroupName: customer.groupName,
      toGroupInnerId: group.innerId,
      toGroupName: group.name,
    });
  }
  return out;
}

/**
 * POST multipart file → preview
 * POST JSON { apply: true, moves: [{ customerInnerId, toGroupInnerId }] } → apply
 */
export async function POST(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      let body: {
        apply?: boolean;
        moves?: { customerInnerId: number; toGroupInnerId: number }[];
      };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
      }
      if (!body.apply || !Array.isArray(body.moves)) {
        return NextResponse.json(
          { error: "apply + moves kötelező" },
          { status: 400 },
        );
      }

      const moves = body.moves
        .map((m) => ({
          customerInnerId: Number(m.customerInnerId),
          toGroupInnerId: Number(m.toGroupInnerId),
        }))
        .filter(
          (m) =>
            Number.isFinite(m.customerInnerId) &&
            m.customerInnerId > 0 &&
            Number.isFinite(m.toGroupInnerId),
        );

      if (moves.length === 0) {
        return NextResponse.json(
          { error: "Nincs alkalmazható sor." },
          { status: 400 },
        );
      }
      if (moves.length > 200) {
        return NextResponse.json(
          { error: "Egyszerre max 200 sor." },
          { status: 400 },
        );
      }

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

          const map = await listGroupMap(client, loaded.shopId);
          const srGroups = await listCustomerGroups(loaded.config);

          let applied = 0;
          let fail = 0;
          const errors: string[] = [];

          for (const m of moves) {
            try {
              const target =
                map.find((x) => x.sr_group_inner_id === m.toGroupInnerId) ||
                null;
              const srTarget = srGroups.find(
                (g) => g.innerId === m.toGroupInnerId,
              );
              const groupOuterId = target?.sr_group_id || srTarget?.id;
              const groupName =
                target?.sr_name_snapshot ||
                srTarget?.name ||
                `Csoport ${m.toGroupInnerId}`;
              if (!groupOuterId) {
                fail += 1;
                errors.push(`#${m.customerInnerId}: ismeretlen csoport`);
                continue;
              }

              const found = await searchCustomers(
                loaded.config,
                String(m.customerInnerId),
                { limit: 1, groups: srGroups },
              );
              const customer = found[0];
              if (!customer) {
                fail += 1;
                errors.push(`#${m.customerInnerId}: nincs vevő`);
                continue;
              }

              await updateCustomerGroup(
                loaded.config,
                customer.id,
                groupOuterId,
              );

              const name =
                [customer.lastname, customer.firstname]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || customer.email;

              const ref = await upsertShopCustomer(client, {
                shopId: loaded.shopId,
                srCustomerInnerId: customer.innerId,
                srCustomerId: customer.id,
                email: customer.email,
                nameSnapshot: name,
                phoneSnapshot: customer.telephone,
                srGroupInnerId: m.toGroupInnerId,
                srGroupNameSnapshot: groupName,
                srStatus: "active",
              });

              await recordGroupMove(client, {
                shopId: loaded.shopId,
                shopCustomerId: ref.id,
                srCustomerInnerId: customer.innerId,
                emailSnapshot: customer.email,
                fromGroupInnerId: customer.groupInnerId,
                fromGroupName: customer.groupName,
                toGroupInnerId: m.toGroupInnerId,
                toGroupName: groupName,
                actorUserId: auth.userId,
                orgId: auth.activeOrganizationId!,
                source: "manual",
                reason: "Excel import",
              });
              applied += 1;
            } catch (e) {
              fail += 1;
              errors.push(
                `#${m.customerInnerId}: ${e instanceof Error ? e.message : "hiba"}`,
              );
            }
          }

          return { applied, fail, errors: errors.slice(0, 20) };
        },
      );

      const message =
        result.fail === 0
          ? `${result.applied} vevő csoportja frissült.`
          : `${result.applied} sikerült, ${result.fail} nem.`;

      return NextResponse.json({ ok: true, message, ...result });
    }

    /* Preview: multipart file */
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Válassz .xlsx fájlt." },
        { status: 400 },
      );
    }
    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length > 2_000_000) {
      return NextResponse.json(
        { error: "A fájl túl nagy (max 2 MB)." },
        { status: 400 },
      );
    }

    const rawRows = parseCustomerImportBuffer(buf, 500);
    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "Üres fájl vagy nincs email/csoport oszlop." },
        { status: 400 },
      );
    }

    const preview = await withTenant(
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
        const srGroups = await listCustomerGroups(loaded.config);
        const rows = await buildPreview(loaded.config, srGroups, rawRows);
        const summary = {
          total: rows.length,
          ok: rows.filter((r) => r.status === "ok").length,
          same: rows.filter((r) => r.status === "same_group").length,
          unknownEmail: rows.filter((r) => r.status === "unknown_email").length,
          unknownGroup: rows.filter((r) => r.status === "unknown_group").length,
          invalid: rows.filter((r) => r.status === "invalid").length,
        };
        return { rows, summary };
      },
    );

    return NextResponse.json({ ok: true, ...preview });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    console.error("[POST merchant/customers/import]", err);
    return NextResponse.json(
      { error: msg || "Import sikertelen" },
      { status: 500 },
    );
  }
}
