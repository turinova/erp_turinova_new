import { getShoprenterConfigForRequest } from "@/lib/shoprenter";
import { getCustomerPurchaseInsights } from "@/lib/purchase-insights";
import { jsonWithCors, optionsCors } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = (url.searchParams.get("userId") || "").trim();
    if (!userId || userId === "0") {
      return jsonWithCors(
        request,
        { error: "Query param userId required (logged-in customer)" },
        { status: 401 },
      );
    }
    const config = await getShoprenterConfigForRequest(request);
    const insights = await getCustomerPurchaseInsights(config, userId);
    return jsonWithCors(request, insights);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "insights failed";
    const status = /bejelentkezés|email/i.test(msg) ? 401 : 500;
    return jsonWithCors(request, { error: msg }, { status });
  }
}
