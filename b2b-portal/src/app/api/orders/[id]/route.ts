import {
  getShoprenterConfigForRequest,
  getCustomerOrderDetail,
} from "@/lib/shoprenter";
import { jsonWithCors, optionsCors } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId || "").trim();
    const url = new URL(request.url);
    const userId = (url.searchParams.get("userId") || "").trim();

    if (!id) {
      return jsonWithCors(request, { error: "Order id required" }, { status: 400 });
    }
    if (!userId || userId === "0") {
      return jsonWithCors(
        request,
        { error: "Query param userId required (logged-in customer)" },
        { status: 401 },
      );
    }

    const config = await getShoprenterConfigForRequest(request);
    const order = await getCustomerOrderDetail(config, id, userId);
    return jsonWithCors(request, { order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "order detail failed";
    let status = 500;
    if (/does not belong/i.test(msg)) status = 403;
    else if (/bejelentkezés|email/i.test(msg)) status = 401;
    else if (/not found|failed \(404\)/i.test(msg)) status = 404;
    return jsonWithCors(request, { error: msg }, { status });
  }
}
