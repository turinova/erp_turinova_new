import { jsonWithCors, optionsCors } from "@/lib/cors";
import { withPlatformAdmin } from "@/lib/db";
import { insertB2bOrder } from "@/lib/merchant/b2b-orders";
import {
  getShoprenterConfigForRequest,
  listCustomerOrders,
  resolveShopContextForRequest,
} from "@/lib/shoprenter";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = (url.searchParams.get("userId") || "").trim();
    const limit = Number(url.searchParams.get("limit") || "30");
    const page = Number(url.searchParams.get("page") || "0");

    if (!userId || userId === "0") {
      return jsonWithCors(
        request,
        { error: "Query param userId required (logged-in customer)" },
        { status: 401 },
      );
    }

    const config = await getShoprenterConfigForRequest(request);
    const result = await listCustomerOrders(config, userId, {
      limit: Number.isFinite(limit) ? limit : 30,
      page: Number.isFinite(page) ? page : 0,
    });

    return jsonWithCors(request, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "orders list failed";
    const status = /bejelentkezés|email/i.test(msg) ? 401 : 500;
    return jsonWithCors(request, { error: msg }, { status });
  }
}

type AttributeLine = {
  sku?: string;
  name?: string;
  qty?: number;
  quantity?: number;
  unit_net?: number;
  unit_gross?: number;
  vat_rate?: number;
};

type AttributeBody = {
  userId?: string | number;
  userGroupId?: string | number | null;
  lines?: AttributeLine[];
};

/** Widget kosárba rakás → Active Partner fact (D19). Nem blokkolja a Shoprenter kosarat. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AttributeBody;
    const userId = Number(body.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonWithCors(
        request,
        { ok: false, skipped: true, reason: "no_customer" },
        { status: 400 },
      );
    }

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (rawLines.length === 0) {
      return jsonWithCors(
        request,
        { error: "lines required" },
        { status: 400 },
      );
    }
    if (rawLines.length > 200) {
      return jsonWithCors(
        request,
        { error: "Max 200 lines" },
        { status: 400 },
      );
    }

    const lines = rawLines
      .map((l) => {
        const qty = Number(l.qty ?? l.quantity ?? 0);
        const sku = typeof l.sku === "string" ? l.sku.trim() : "";
        if (!sku || !Number.isFinite(qty) || qty <= 0) return null;
        return {
          sku,
          name: typeof l.name === "string" ? l.name : undefined,
          qty,
          unit_net:
            l.unit_net != null && Number.isFinite(Number(l.unit_net))
              ? Number(l.unit_net)
              : null,
          unit_gross:
            l.unit_gross != null && Number.isFinite(Number(l.unit_gross))
              ? Number(l.unit_gross)
              : null,
          vat_rate:
            l.vat_rate != null && Number.isFinite(Number(l.vat_rate))
              ? Number(l.vat_rate)
              : null,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l != null);

    if (lines.length === 0) {
      return jsonWithCors(
        request,
        { error: "Nincs érvényes tétel" },
        { status: 400 },
      );
    }

    const groupRaw = body.userGroupId;
    const srGroupInnerId =
      groupRaw != null && groupRaw !== "" && Number.isFinite(Number(groupRaw))
        ? Number(groupRaw)
        : null;

    let netTotal: number | null = 0;
    for (const l of lines) {
      if (l.unit_net == null) {
        netTotal = null;
        break;
      }
      netTotal += l.unit_net * l.qty;
    }

    const shop = await resolveShopContextForRequest(request, {
      body: body as Record<string, unknown>,
    });
    const inserted = await withPlatformAdmin((client) =>
      insertB2bOrder(client, {
        shopId: shop.shopId,
        srCustomerInnerId: userId,
        srGroupInnerId,
        currency: "HUF",
        netTotal,
        lines,
        source: "widget",
        meta: { attributed: "cart_add" },
      }),
    );

    /* Fire-and-forget: automatizmus „rendelés után” mód — 1 vevő, debounce-szal */
    const customerInnerId = Number(userId);
    if (Number.isFinite(customerInnerId) && customerInnerId > 0) {
      void import("@/lib/merchant/group-rules-auto")
        .then((m) =>
          m.maybeRunGroupRulesAfterOrder({
            shopId: shop.shopId,
            organizationId: shop.organizationId,
            customerInnerId,
          }),
        )
        .catch(() => undefined);
    }

    return jsonWithCors(request, { ok: true, id: inserted.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "order attribute failed";
    console.error("[POST /api/orders]", msg);
    return jsonWithCors(request, { error: msg }, { status: 500 });
  }
}
