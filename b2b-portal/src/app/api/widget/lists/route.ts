import { jsonWithCors, optionsCors } from "@/lib/cors";
import { withPlatformAdmin } from "@/lib/db";
import { resolveShopContextForRequest } from "@/lib/shoprenter/resolve-shop";
import {
  createCustomerList,
  listCustomerLists,
  normalizeListLines,
  type WidgetListLine,
} from "@/lib/widget/customer-lists";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

function parseUserId(request: Request, body?: Record<string, unknown>): number {
  const url = new URL(request.url);
  const raw =
    (body?.userId ?? body?.customerId) ??
    url.searchParams.get("userId") ??
    url.searchParams.get("customerId") ??
    "";
  return Number(raw);
}

/** GET /api/widget/lists?shopId=&userId= — partner saját listái */
export async function GET(request: Request) {
  try {
    const userId = parseUserId(request);
    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonWithCors(
        request,
        { error: "userId required" },
        { status: 400 },
      );
    }
    const shop = await resolveShopContextForRequest(request);
    const lists = await withPlatformAdmin((client) =>
      listCustomerLists(client, shop.shopId, userId),
    );
    return jsonWithCors(request, { ok: true, lists });
  } catch (err) {
    console.error("[GET widget/lists]", err);
    const msg = err instanceof Error ? err.message : "lists failed";
    const status =
      msg.includes("does not exist") || msg.includes("widget_customer_lists")
        ? 503
        : 500;
    return jsonWithCors(
      request,
      {
        error:
          status === 503
            ? "Listák tábla hiányzik. Futtasd a sql/032_widget_customer_lists.sql fájlt."
            : msg,
      },
      { status },
    );
  }
}

/** POST /api/widget/lists — új lista mentése */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = parseUserId(request, body);
    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonWithCors(
        request,
        { error: "userId required" },
        { status: 400 },
      );
    }
    const shop = await resolveShopContextForRequest(request, { body });
    const lines = normalizeListLines(body.lines) as WidgetListLine[];
    const result = await withPlatformAdmin((client) =>
      createCustomerList(client, {
        shopId: shop.shopId,
        customerInnerId: userId,
        name: String(body.name ?? ""),
        lines,
      }),
    );
    if (!result.ok) {
      return jsonWithCors(
        request,
        { error: result.error },
        { status: result.status },
      );
    }
    return jsonWithCors(request, { ok: true, list: result.list });
  } catch (err) {
    console.error("[POST widget/lists]", err);
    const msg = err instanceof Error ? err.message : "create list failed";
    return jsonWithCors(request, { error: msg }, { status: 500 });
  }
}
