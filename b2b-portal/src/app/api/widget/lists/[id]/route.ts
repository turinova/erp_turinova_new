import { jsonWithCors, optionsCors } from "@/lib/cors";
import { withPlatformAdmin } from "@/lib/db";
import { resolveShopContextForRequest } from "@/lib/shoprenter/resolve-shop";
import {
  deleteCustomerList,
  getCustomerList,
  normalizeListLines,
  updateCustomerList,
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

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/widget/lists/[id] */
export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const userId = parseUserId(request);
    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonWithCors(
        request,
        { error: "userId required" },
        { status: 400 },
      );
    }
    const shop = await resolveShopContextForRequest(request);
    const list = await withPlatformAdmin((client) =>
      getCustomerList(client, shop.shopId, userId, id),
    );
    if (!list) {
      return jsonWithCors(request, { error: "Lista nem található" }, { status: 404 });
    }
    return jsonWithCors(request, { ok: true, list });
  } catch (err) {
    console.error("[GET widget/lists/id]", err);
    return jsonWithCors(
      request,
      { error: err instanceof Error ? err.message : "list failed" },
      { status: 500 },
    );
  }
}

/** PATCH /api/widget/lists/[id] — átnevezés / tételek frissítése */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
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
    const patch: {
      shopId: string;
      customerInnerId: number;
      listId: string;
      name?: string;
      lines?: WidgetListLine[];
    } = {
      shopId: shop.shopId,
      customerInnerId: userId,
      listId: id,
    };
    if (typeof body.name === "string") patch.name = body.name;
    if (body.lines !== undefined) {
      patch.lines = normalizeListLines(body.lines);
    }
    const result = await withPlatformAdmin((client) =>
      updateCustomerList(client, patch),
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
    console.error("[PATCH widget/lists/id]", err);
    return jsonWithCors(
      request,
      { error: err instanceof Error ? err.message : "update list failed" },
      { status: 500 },
    );
  }
}

/** DELETE /api/widget/lists/[id] */
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const userId = parseUserId(request);
    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonWithCors(
        request,
        { error: "userId required" },
        { status: 400 },
      );
    }
    const shop = await resolveShopContextForRequest(request);
    const ok = await withPlatformAdmin((client) =>
      deleteCustomerList(client, shop.shopId, userId, id),
    );
    if (!ok) {
      return jsonWithCors(request, { error: "Lista nem található" }, { status: 404 });
    }
    return jsonWithCors(request, { ok: true });
  } catch (err) {
    console.error("[DELETE widget/lists/id]", err);
    return jsonWithCors(
      request,
      { error: err instanceof Error ? err.message : "delete list failed" },
      { status: 500 },
    );
  }
}
